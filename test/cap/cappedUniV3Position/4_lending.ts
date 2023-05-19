import { s } from "./scope";
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

const borrowAmount = BN("500e18")


describe("Check starting values", () => {
    const amount = BN("500e18")

    it("Check borrow power / LTV", async () => {
        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(borrowPower).to.be.gt(0, "There exists a borrow power against capped token")

        let balance = await s.CappedPosition.balanceOf(s.BobVault.address)
        let price = await s.Oracle.getLivePrice(s.CappedPosition.address)

        //showBody("Indicated Balance: ", await toNumber(balance))
        //showBody("Indicated BorrowPower: ", await toNumber(borrowPower))

        let totalValue = (balance.mul(price)).div(BN("1e18"))

        //showBody("Total value: ", await toNumber(totalValue))

        let expectedBorrowPower = (totalValue.mul(s.LTV)).div(BN("1e18"))
        expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(expectedBorrowPower), 0.0001, "Borrow power is correct")

    })
})


 describe("Lending with capped Balancer LP tokens and uniPosition", () => {
    it("Borrow a small amount against staked capped uniPosition", async () => {


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

        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(s.Bob_USDC.mul(10), "Bob still holds starting USDC")

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


describe("Liquidations - uniPosition", () => {

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

        await fastForward(OneDay)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        const solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is now underwater")

    })

    it("Try to withdraw when vault is underwater", async () => {
        const amount = BN("250e18")
        expect(s.BobVault.connect(s.Bob).withdrawErc20(s.CappedPosition.address, amount)).to.be.revertedWith("over-withdrawal")
    })

    it("Liquidate", async () => {

        const amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Vault underwater")

        const tokensToLiquidate = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.CappedPosition.address)
        T2L = tokensToLiquidate
        showBody("T2L: ", await toNumber(T2L))
        expect(tokensToLiquidate).to.be.gt(0, "Capped Tokens are liquidatable")

        const price = await s.Oracle.getLivePrice(s.CappedPosition.address)
        expect(price).to.be.gt(0, "Valid price")

        const liquidationValue = (price.mul(tokensToLiquidate)).div(BN("1e18"))

        //const startSupply = await s.CappedPosition.totalSupply()
        //expect(startSupply).to.eq(borrowAmount, "Starting supply unchanged")

        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).deposit(await s.USDC.balanceOf(s.Dave.address))
        await mineBlock()



        const startingUSDI = await s.USDI.balanceOf(s.Dave.address)
        expect(startingUSDI).to.eq((s.USDC_AMOUNT.mul(5)).mul(BN("1e12")))

        const startinguniPosition = await s.CappedPosition.balanceOf(s.BobVault.address)
        const startuniPosition = await s.nfpManager.balanceOf(s.Dave.address)
        expect(startuniPosition).to.eq(0, "Dave holds 0 uniPosition")


        /**
         * When liquidating a position (1 position with x amount of value scenario)
         * the full position must be liquidated => nfpManager.balanceOf(liquidator) = 1
         * balanceOf returns the value
         * tokensToLiquidate needs to == balanceOf (value)
         * the liability of the vault needs to be set to 0
         */

        showBody("Dave: ", s.Dave.address)
        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedPosition.address, BN("1e50"))
        const gas = await getGas(result)
        showBodyCyan("Gas to liquidate uniPosition: ", gas)
        
        //let supply = await s.CappedPosition.totalSupply()
        //expect(await toNumber(supply)).to.be.closeTo(await toNumber(startSupply.sub(tokensToLiquidate)), 10, "Total supply reduced as Capped uniPosition is liquidatede")

    

        let endCappedPosition = await s.CappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(endCappedPosition)).to.be.closeTo(await toNumber(startinguniPosition.sub(tokensToLiquidate)), 0.1, "Expected amount liquidated")

        let enduniPosition = await s.nfpManager.balanceOf(s.Dave.address)
        expect(await toNumber(enduniPosition)).to.be.closeTo(await toNumber(tokensToLiquidate), 0.1, "Dave received the underlying uniPosition")

        const usdiSpent = startingUSDI.sub(await s.USDI.balanceOf(s.Dave.address))

        //price - liquidation incentive (5%)
        const effectivePrice = (price.mul(BN("1e18").sub(s.LiquidationIncentive))).div(BN("1e18"))
        const realPrice = ((tokensToLiquidate.mul(effectivePrice)).div(tokensToLiquidate))
        expect(await toNumber(realPrice)).to.be.closeTo(await toNumber(effectivePrice), 0.1, "Effective price is correct")


        const profit = liquidationValue.sub(usdiSpent)
        const expected = (liquidationValue.mul(s.LiquidationIncentive)).div(BN("1e18"))

        expect(await toNumber(profit)).to.be.closeTo(await toNumber(expected), 2, "Expected profit achieved")

    })
/**
    it("repay all", async () => {

        let liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liab).to.be.gt(0, "Liability exists")

        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await mineBlock()

        liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liab).to.eq(0, "Loan completely repaid")
    })


    it("Withdraw after loan", async () => {

        const voteVaultuniPosition = await s.uniPosition.balanceOf(s.BobBptVault.address)
        expect(voteVaultuniPosition).to.be.gt(0, "Vote vault holds uniPosition")
        const vaultCappedPosition = await s.CappedPosition.balanceOf(s.BobVault.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedPosition.address, vaultCappedPosition)
        await mineBlock()

        let balance = await s.uniPosition.balanceOf(s.BobBptVault.address)
        expect(await toNumber(balance)).to.eq(0, "All uniPosition withdrawn")

        balance = await s.CappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All CappedPosition removed from vault")

        //const supply = await s.CappedPosition.totalSupply()
        //expect(await toNumber(supply)).to.eq(0, "All CappedPosition Burned")

        balance = await s.uniPosition.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.uniPositionAmount.sub(T2L)), 2, "Bob received collateral - liquidated amount")

    })

    it("mappings", async () => {
        const _vaultAddress_vaultId = await s.VotingVaultController._vaultAddress_vaultId(s.BobVault.address)
        expect(_vaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_vaultBPTaddress(BN(s.BobVaultID))
        expect(_vaultId_votingVaultAddress.toUpperCase()).to.equal(s.BobBptVault.address.toUpperCase(), "Correct voting vault ID")

        const _votingVaultAddress_vaultId = await s.VotingVaultController._vaultBPTaddress_vaultId(s.BobBptVault.address)
        expect(_votingVaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.uniPosition.address)
        expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedPosition.address.toUpperCase(), "Underlying => Capped is correct")

        const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedPosition.address)
        expect(_CappedToken_underlying.toUpperCase()).to.eq(s.uniPosition.address.toUpperCase(), "Capped => Underlying correct")
    })
*/
})

 