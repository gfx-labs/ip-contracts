import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear, OneDay } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import { red } from "bn.js";
import { start } from "repl";
import { VotingVault__factory } from "../../../typechain-types";
import { stealMoney } from "../../../util/money";
require("chai").should();

const borrowAmount = BN("25e18")


describe("Check starting values", () => {
    const amount = BN("50e24")
    it("Check starting balance", async () => {
        const startCap = await s.CappedMatic.balanceOf(s.BobVault.address)
        expect(startCap).to.eq(amount, "Starting balance is correct")

        let balance = await s.WBTC.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")

        balance = await s.WETH.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")

        balance = await s.UNI.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")
        let liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Bob's vault has no outstanding debt")
    })

    it("Check borrow power / LTV", async () => {
        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(borrowPower).to.be.gt(0, "There exists a borrow power against capped token")

        const balance = await s.CappedMatic.balanceOf(s.BobVault.address)
        const price = await s.Oracle.getLivePrice(s.CappedMatic.address)
        let totalValue = (balance.mul(price)).div(BN("1e18"))
        let expectedBorrowPower = (totalValue.mul(s.UNI_LTV)).div(BN("1e18"))

        expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(expectedBorrowPower), 0.0001, "Borrow power is correct")
    })
})

describe("Lending", () => {
    it("Borrow a small amount against capped token", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)
        expect(startUSDI).to.eq(0, "Bob holds 0 USDi")

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)
        await mineBlock()

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startUSDI.add(borrowAmount.mul(2))), 0.001, "Bob received USDi loan")

    })

    it("Check loan details", async () => {

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.be.closeTo(await toNumber(borrowAmount.mul(2)), 0.001, "Liability is correct")

    })

    it("Repay loan", async () => {
        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(s.Bob_USDC, "Bob still holds starting USDC")

        //deposit some to be able to repay all
        await s.USDC.connect(s.Bob).approve(s.USDI.address, BN("50e6"))
        await s.USDI.connect(s.Bob).deposit(BN("50e6"))
        await mineBlock()

        await s.USDI.connect(s.Bob).approve(s.VaultController.address, await s.USDI.balanceOf(s.Bob.address))
        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        //await mineBlock()
        //await mineBlock()
        await advanceBlockHeight(1)
        await fastForward(OneDay)


        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Loan repaid")
    })
})



describe("Liquidations", () => {

    let borrowPower: BigNumber
    let T2L: BigNumber

    before(async () => {
        borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
    })



    it("Borrow max", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)

        let startLiab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(startLiab).to.eq(0, "Liability is still 0")

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowPower)
        await mineBlock()
        const liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liab)).to.be.closeTo(await toNumber(borrowPower), 0.001, "Liability is correct")

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower.add(startUSDI)), 0.1, "Balance is correct")

    })

    it("Elapse time to put vault underwater", async () => {

        await fastForward(OneWeek)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        const solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is now underwater")

    })

    it("Try to withdraw when vault is underwater", async () => {
        const amount = BN("250e18")
        expect(s.BobVault.connect(s.Bob).withdrawErc20(s.CappedMatic.address, amount)).to.be.revertedWith("over-withdrawal")
    })

    it("Liquidate", async () => {

        const amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Vault underwater")


        // give dave some money
        await stealMoney("0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503", s.Dave.address, s.usdcAddress, BN("200e12"))
        await mineBlock()

        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).deposit(await s.USDC.balanceOf(s.Dave.address))
        await mineBlock()

        const tokensToLiquidate = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.CappedMatic.address)
        T2L = tokensToLiquidate
        expect(tokensToLiquidate).to.be.gt(0, "Capped Tokens are liquidatable")

        const price = await s.Oracle.getLivePrice(s.CappedMatic.address)
        expect(price).to.be.gt(0, "Valid price")

        const liquidationValue = (price.mul(tokensToLiquidate)).div(BN("1e18"))

        const startSupply = await s.CappedMatic.totalSupply()
        //expect(startSupply).to.eq(borrowAmount.mul(2).add(69), "Starting supply unchanged")

        const startingUSDI = await s.USDI.balanceOf(s.Dave.address)
        expect(startingUSDI).to.eq(s.Dave_USDC.add(BN("200e12")).mul(BN("1e12")))

        const startingCMATIC = await s.CappedMatic.balanceOf(s.BobVault.address)
        const startMATIC = await s.MATIC.balanceOf(s.Dave.address)
        expect(startMATIC).to.eq(0, "Dave holds 0 MATIC")

        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedMatic.address, BN("1e50"))
        await mineBlock()

        let supply = await s.CappedMatic.totalSupply()

        expect(await toNumber(supply)).to.be.closeTo(await toNumber(startSupply.sub(tokensToLiquidate)), 1, "Total supply reduced as Capped MATIC is liquidated")

        let endCMATIC = await s.CappedMatic.balanceOf(s.BobVault.address)
        expect(await toNumber(endCMATIC)).to.be.closeTo(await toNumber(startingCMATIC.sub(tokensToLiquidate)), 1, "Expected amount liquidated")

        let endMATIC = await s.MATIC.balanceOf(s.Dave.address)
        expect(await toNumber(endMATIC)).to.be.closeTo(await toNumber(tokensToLiquidate), 1, "Dave received the underlying MATIC")

        const usdiSpent = startingUSDI.sub(await s.USDI.balanceOf(s.Dave.address))

        //price - liquidation incentive (5%)
        const effectivePrice = (price.mul(BN("1e18").sub(s.LiquidationIncentive))).div(BN("1e18"))
        const realPrice = ((tokensToLiquidate.mul(effectivePrice)).div(tokensToLiquidate))
        expect(await toNumber(realPrice)).to.be.closeTo(await toNumber(effectivePrice), 0.001, "Effective price is correct")


        const profit = liquidationValue.sub(usdiSpent)
        const expected = (liquidationValue.mul(s.LiquidationIncentive)).div(BN("1e18"))

        expect(await toNumber(profit)).to.be.closeTo(await toNumber(expected), 5, "Expected profit achieved")

    })

    it("repay all", async () => {

        let liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liab).to.be.gt(0, "Liability exists")

        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await mineBlock()

        liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liab).to.eq(0, "Loan completely repaid")
    })


    it("Withdraw after loan", async () => {
        const voteVaultMATIC = await s.MATIC.balanceOf(s.BobVotingVault.address)
        expect(voteVaultMATIC).to.be.gt(0, "Vote vault holds MATIC")
        const vaultCappedMATIC = await s.CappedMatic.balanceOf(s.BobVault.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedMatic.address, vaultCappedMATIC)
        await mineBlock()

        let balance = await s.MATIC.balanceOf(s.BobVotingVault.address)
        expect(await toNumber(balance)).to.eq(0, "All MATIC withdrawn")

        balance = await s.CappedMatic.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All CappedMATIC removed from vault")

        const supply = await s.CappedMatic.totalSupply()
        expect(supply).to.eq(0, "All New CappedMATIC Burned")

        balance = await s.MATIC.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.MATIC_AMOUNT.sub(T2L)), 5, "Bob received collateral - liquidated amount")

    })

    it("mappings", async () => {
        const _vaultAddress_vaultId = await s.VotingVaultController._vaultAddress_vaultId(s.BobVault.address)
        expect(_vaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(BN(s.BobVaultID))
        expect(_vaultId_votingVaultAddress.toUpperCase()).to.equal(s.BobVotingVault.address.toUpperCase(), "Correct voting vault ID")

        const _votingVaultAddress_vaultId = await s.VotingVaultController._votingVaultAddress_vaultId(s.BobVotingVault.address)
        expect(_votingVaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.MATIC.address)
        expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedMatic.address.toUpperCase(), "Underlying => Capped is correct")

        const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedMatic.address)
        expect(_CappedToken_underlying.toUpperCase()).to.eq(s.MATIC.address.toUpperCase(), "Capped => Underlying correct")
    })

})
