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
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { start } from "repl";
import { VotingVault__factory } from "../../../typechain-types";
require("chai").should();

const borrowAmount = s.AuraBalAmount


describe("Check starting values", () => {
    const amount = BN("500e18")

    it("Stake capped auraBal - future tests are against staked auraBal", async () => {
        await s.BobBptVault.connect(s.Bob).stakeAuraLP(s.auraBal.address)
        
        let balance = await s.auraBalRewards.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Correct amount staked")
        balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "0 auraBal remaining unstaked")
    })

    it("Check borrow power / LTV", async () => {
        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(borrowPower).to.be.gt(0, "There exists a borrow power against capped token")

        //aura bal
        let balance = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        let price = await s.Oracle.getLivePrice(s.CappedAuraBal.address)
        let totalValue = (balance.mul(price)).div(BN("1e18"))

        //showBody("Total value: ", await toNumber(totalValue))

        balance = await s.CappedAuraLP.balanceOf(s.BobVault.address)
        price = await s.Oracle.getLivePrice(s.CappedAuraLP.address)
        const auraLPvalue = (balance.mul(price)).div(BN("1e18"))
        //showBody("auraLP value: ", auraLPvalue)

        balance = await s.CappedStethGauge.balanceOf(s.BobVault.address)
        price = await s.Oracle.getLivePrice(s.CappedStethGauge.address)
        const gaugeValue = (balance.mul(price)).div(BN("1e18"))

        totalValue = totalValue.add(auraLPvalue).add(gaugeValue)
        //showBody("Total value: ", await toNumber(totalValue))


        let expectedBorrowPower = (totalValue.mul(s.auraBalLTV)).div(BN("1e18"))
        expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(expectedBorrowPower), 0.0001, "Borrow power is correct")
    })
})

describe("Lending with capped Balancer LP tokens and AuraBal", () => {
    it("Borrow a small amount against staked capped auraBal", async () => {


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
        await fastForward(OneDay)


        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Loan repaid")

    })
})


describe("Liquidations - auraBal", () => {

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
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower.add(startUSDI)), 0.001, "Balance is correct")

    })

    it("Elapse time to put vault underwater", async () => {

        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        const solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is now underwater")

    })

    it("Try to withdraw when vault is underwater", async () => {
        const amount = BN("250e18")
        expect(s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAuraBal.address, amount)).to.be.revertedWith("over-withdrawal")
    })

    it("Liquidate", async () => {

        const amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Vault underwater")

        const tokensToLiquidate = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.CappedAuraBal.address)
        T2L = tokensToLiquidate
        expect(tokensToLiquidate).to.be.gt(0, "Capped Tokens are liquidatable")

        const price = await s.Oracle.getLivePrice(s.CappedAuraBal.address)
        expect(price).to.be.gt(0, "Valid price")

        const liquidationValue = (price.mul(tokensToLiquidate)).div(BN("1e18"))

        const startSupply = await s.CappedAuraBal.totalSupply()
        expect(startSupply).to.eq(borrowAmount, "Starting supply unchanged")

        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).deposit(await s.USDC.balanceOf(s.Dave.address))
        await mineBlock()

        let supply = await s.CappedAuraBal.totalSupply()

        expect(await toNumber(supply)).to.be.closeTo(await toNumber(startSupply.sub(tokensToLiquidate)), 10, "Total supply reduced as Capped auraBal is liquidatede")

        const startingUSDI = await s.USDI.balanceOf(s.Dave.address)
        expect(startingUSDI).to.eq(s.USDC_AMOUNT.mul(BN("1e12")))

        const startingAuraBal = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        const startauraBal = await s.auraBal.balanceOf(s.Dave.address)
        expect(startauraBal).to.eq(0, "Dave holds 0 auraBal")

        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedAuraBal.address, BN("1e50"))
        await mineBlock()

        //ensure balances are correct
        let balance = await s.auraBalRewards.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "All reward tokens have been unstaked due to liquidation")


        let endwauraBal = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        expect(await toNumber(endwauraBal)).to.be.closeTo(await toNumber(startingAuraBal.sub(tokensToLiquidate)), 0.0001, "Expected amount liquidated")

        let endauraBal = await s.auraBal.balanceOf(s.Dave.address)
        expect(await toNumber(endauraBal)).to.be.closeTo(await toNumber(tokensToLiquidate), 0.001, "Dave received the underlying auraBal")

        const usdiSpent = startingUSDI.sub(await s.USDI.balanceOf(s.Dave.address))

        //price - liquidation incentive (5%)
        const effectivePrice = (price.mul(BN("1e18").sub(s.LiquidationIncentive))).div(BN("1e18"))
        const realPrice = ((tokensToLiquidate.mul(effectivePrice)).div(tokensToLiquidate))
        expect(await toNumber(realPrice)).to.be.closeTo(await toNumber(effectivePrice), 0.001, "Effective price is correct")


        const profit = liquidationValue.sub(usdiSpent)
        const expected = (liquidationValue.mul(s.LiquidationIncentive)).div(BN("1e18"))

        expect(await toNumber(profit)).to.be.closeTo(await toNumber(expected), 0.1, "Expected profit achieved")

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

        const voteVaultauraBal = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(voteVaultauraBal).to.be.gt(0, "Vote vault holds auraBal")
        const vaultCappedAuraBal = await s.CappedAuraBal.balanceOf(s.BobVault.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAuraBal.address, vaultCappedAuraBal)
        await mineBlock()

        let balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(await toNumber(balance)).to.eq(0, "All auraBal withdrawn")

        balance = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All CappedAuraBal removed from vault")

        const supply = await s.CappedAuraBal.totalSupply()
        expect(await toNumber(supply)).to.eq(0, "All CappedAuraBal Burned")

        balance = await s.auraBal.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.AuraBalAmount.sub(T2L)), 2, "Bob received collateral - liquidated amount")

    })

    it("mappings", async () => {
        const _vaultAddress_vaultId = await s.VotingVaultController._vaultAddress_vaultId(s.BobVault.address)
        expect(_vaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_vaultBPTaddress(BN(s.BobVaultID))
        expect(_vaultId_votingVaultAddress.toUpperCase()).to.equal(s.BobBptVault.address.toUpperCase(), "Correct voting vault ID")

        const _votingVaultAddress_vaultId = await s.VotingVaultController._vaultBPTaddress_vaultId(s.BobBptVault.address)
        expect(_votingVaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.auraBal.address)
        expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedAuraBal.address.toUpperCase(), "Underlying => Capped is correct")

        const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedAuraBal.address)
        expect(_CappedToken_underlying.toUpperCase()).to.eq(s.auraBal.address.toUpperCase(), "Capped => Underlying correct")
    })
})
