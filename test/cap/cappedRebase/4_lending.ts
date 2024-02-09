import { s } from "../scope";
import { BN } from "../../../util/number";
import { advanceBlockHeight, fastForward, OneYear, OneDay } from "../../../util/block";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { toNumber } from "../../../util/math";
import { showBody } from "../../../util/format";
require("chai").should();

const borrowAmount = BN("50e18")


describe("Lending with capped aUSDC", () => {
    it("Borrow a small amount against capped token", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)
        expect(startUSDI).to.eq(0, "Bob holds 0 USDi")

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startUSDI.add(borrowAmount.mul(2))), 0.001, "Bob received USDi loan")

    })

    it("Check loan details", async () => {

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.be.closeTo(await toNumber(borrowAmount.mul(2)), 0.001, "Liability is correct")

    })

    it("Repay loan", async () => {
        //deposit some to be able to repay all
        await s.USDC.connect(s.Bob).approve(s.USDI.address, s.USDC_AMOUNT)
        await s.USDI.connect(s.Bob).deposit(s.USDC_AMOUNT)

        await s.USDI.connect(s.Bob).approve(s.VaultController.address, await s.USDI.balanceOf(s.Bob.address))
        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Loan repaid")
    })
})

describe("Liquidations", () => {

    let borrowPower: BigNumber
    let T2L: BigNumber

    before(async () => {
        borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        showBody("BP: ", await toNumber(borrowPower))
    })

    /**
    it("Borrow max", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)

        let startLiab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(startLiab).to.eq(0, "Liability is still 0")
        showBody("Doing")
        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowPower.sub(1))
        showBody("Did")
        const liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liab)).to.be.closeTo(await toNumber(borrowPower), 0.001, "Liability is correct")

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower.add(startUSDI)), 0.001, "Balance is correct")

    })

    it("Elapse time to put vault underwater", async () => {

        await fastForward(OneYear)
        await s.VaultController.calculateInterest()

        const solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is now underwater")

    })

    it("Try to withdraw when vault is underwater", async () => {
        const amount = BN("250e18")
        expect(s.BobVault.connect(s.Bob).withdrawErc20(s.CappedOAUSDC.address, amount)).to.be.revertedWith("over-withdrawal")
    })

    it("Liquidate", async () => {

        const amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Vault underwater")

        const tokensToLiquidate = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.CappedOAUSDC.address)
        T2L = tokensToLiquidate
        expect(tokensToLiquidate).to.be.gt(0, "Capped Tokens are liquidatable")

        const price = await s.Oracle.getLivePrice(s.CappedOAUSDC.address)
        expect(price).to.be.gt(0, "Valid price")

        const liquidationValue = (price.mul(tokensToLiquidate)).div(BN("1e18"))

        const startSupply = await s.CappedOAUSDC.totalSupply()
        expect(startSupply).to.eq(borrowAmount, "Starting supply unchanged")


        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).deposit(await s.USDC.balanceOf(s.Dave.address))

        let supply = await s.CappedOAUSDC.totalSupply()

        expect(await toNumber(supply)).to.be.closeTo(await toNumber(startSupply.sub(tokensToLiquidate)), 2, "Total supply reduced as Capped aUSDC is liquidatede")

        const startingUSDI = await s.USDI.balanceOf(s.Dave.address)
        expect(startingUSDI).to.eq(s.Dave_USDC.mul(BN("1e12")))

        const startingWaUSDC = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
        const startaUSDC = await s.aUSDC.balanceOf(s.Dave.address)
        expect(startaUSDC).to.eq(0, "Dave holds 0 aUSDC")

        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedOAUSDC.address, BN("1e50"))

        let endwaUSDC = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
        expect(await toNumber(endwaUSDC)).to.be.closeTo(await toNumber(startingWaUSDC.sub(tokensToLiquidate)), 0.0001, "Expected amount liquidated")

        let endaUSDC = await s.aUSDC.balanceOf(s.Dave.address)
        expect(await toNumber(endaUSDC)).to.be.closeTo(await toNumber(tokensToLiquidate), 0.001, "Dave received the underlying aUSDC")

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

        liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liab).to.eq(0, "Loan completely repaid")
    })


    it("Withdraw after loan", async () => {

        const voteVaultaUSDC = await s.aUSDC.balanceOf(s.BobVotingVault.address)
        expect(voteVaultaUSDC).to.be.gt(0, "Vote vault holds aUSDC")
        const vaultCappedOAUSDC = await s.CappedOAUSDC.balanceOf(s.BobVault.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedOAUSDC.address, vaultCappedOAUSDC)

        let balance = await s.aUSDC.balanceOf(s.BobVotingVault.address)
        expect(await toNumber(balance)).to.eq(0, "All aUSDC withdrawn")

        balance = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All CappedOAUSDC removed from vault")

        const supply = await s.CappedOAUSDC.totalSupply()
        expect(await toNumber(supply)).to.eq(0, "All CappedOAUSDC Burned")

        balance = await s.aUSDC.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.aUSDCAmount.sub(T2L)), 2, "Bob received collateral - liquidated amount")

    })

    it("mappings", async () => {
        const _vaultAddress_vaultId = await s.VotingVaultController._vaultAddress_vaultId(s.BobVault.address)
        expect(_vaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(BN(s.BobVaultID))
        expect(_vaultId_votingVaultAddress.toUpperCase()).to.equal(s.BobVotingVault.address.toUpperCase(), "Correct voting vault ID")

        const _votingVaultAddress_vaultId = await s.VotingVaultController._votingVaultAddress_vaultId(s.BobVotingVault.address)
        expect(_votingVaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.aUSDCAddress)
        expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedOAUSDC.address.toUpperCase(), "Underlying => Capped is correct")

        const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedOAUSDC.address)
        expect(_CappedToken_underlying.toUpperCase()).to.eq(s.aUSDCAddress.toUpperCase(), "Capped => Underlying correct")
    })
    */
})