import { s } from "../scope";
import { BN } from "../../../util/number";
import { advanceBlockHeight, fastForward, OneYear, OneDay, hardhat_mine, hardhat_mine_timed, mineBlock } from "../../../util/block";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { toNumber } from "../../../util/math";
import { showBody, showBodyCyan } from "../../../util/format";
import { ethers } from "hardhat";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
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



    it("Verify Borrow Power", async () => {

        //get balance of underlying
        const capBal = await s.CappedOAUSDC.balanceOf(s.BobVault.address)

        //BP should be 75% of this in 1e18 terms
        borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        expect(await toNumber(borrowPower)).to.be.closeTo(Number(ethers.utils.formatUnits(capBal, 6)) * 0.75, 1, "Borrow Power Correct")

    })

    it("Borrow max", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)

        let startLiab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(startLiab).to.eq(0, "Liability is still 0")
        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowPower.sub(1))
        const liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liab)).to.be.closeTo(await toNumber(borrowPower), 0.001, "Liability is correct")

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower.add(startUSDI)), 0.001, "Balance is correct")

    })

    it("Elapse time to put vault underwater", async () => {

        await hardhat_mine_timed(200, 2)
        await s.VaultController.calculateInterest()
        await mineBlock()

        ///aUSDC apy > IP apr so can never be underwater
        const bp = await toNumber(await s.VaultController.vaultBorrowingPower(s.BobVaultID))
        const liab = await toNumber(await s.VaultController.vaultLiability(s.BobVaultID))

        expect(bp).to.be.gt(liab, "aUSDC apy > IP apr, so can never be underwater")

        //artificailly lower LTV so that we can test liquidations
        const ownerAddr = await s.VotingVaultController.owner()
        await impersonateAccount(ownerAddr)
        const owner = ethers.provider.getSigner(ownerAddr)
        await s.VaultController.connect(owner).updateRegisteredErc20(
            s.CappedOAUSDC.address,
            BN("70e16"),//reduce LTV from 75 => 70
            s.CappedOAUSDC.address,
            s.LiquidationIncentive
        )
        await ceaseImpersonation(ownerAddr)
        const solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is now underwater")

    })

    it("Try to withdraw when vault is underwater", async () => {
        const amount = BN("1e18")
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
        //expect(startSupply).to.eq(borrowAmount, "Starting supply unchanged")

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

        const vaultCappedOAUSDC = await s.CappedOAUSDC.balanceOf(s.BobVault.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedOAUSDC.address, vaultCappedOAUSDC)

        let balance = await s.aUSDC.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All aUSDC withdrawn")

        balance = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
        expect(balance.toNumber()).to.be.closeTo(0, 10, "All CappedOAUSDC removed from vault")

        balance = await s.aUSDC.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.aUSDCamount.sub(T2L)), 2, "Bob received collateral - liquidated amount")
    })
})