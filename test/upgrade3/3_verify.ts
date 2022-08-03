import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../util/impersonator"

import { BN } from "../../util/number";
import {
    ProxyAdmin,
    ProxyAdmin__factory,
    USDI__factory,
    IVault__factory
} from "../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../util/block";
import { toNumber, getGas } from "../../util/math";

const usdcAmount = BN("50e6")
const usdiAmount = BN("50e18")

const USDC_BORROW = BN("1000e6")//1k USDC
const USDI_BORROW = BN("100e18")//500 USDI

describe("Prepare to test new protocol functions", () => {
    it("mint vaults for testing", async () => {
        //showBody("bob mint vault")
        await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
            .reverted;
        await mineBlock();
        s.BobVaultID = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
        s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
        expect(await s.BobVault.minter()).to.eq(s.Bob.address);

        //showBody("carol mint vault")
        await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
            .reverted;
        await mineBlock();
        s.CaroLVaultID = await s.VaultController.vaultsMinted()
        vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
        s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
        expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
    });

    it("vault deposits", async () => {


        await expect(s.WETH.connect(s.Bob).transfer(s.BobVault.address, s.Bob_WETH))
            .to.not.reverted;
        await expect(
            s.UNI.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_UNI)
        ).to.not.reverted;
        await mineBlock();

        //showBody("bob transfer weth")
        expect(await s.BobVault.tokenBalance(s.wethAddress)).to.eq(s.Bob_WETH)

        //showBody("carol transfer uni")
        expect(await s.CarolVault.tokenBalance(s.uniAddress)).to.eq(s.Carol_UNI)

    });
})

require("chai").should();
describe("Verify Upgraded Contracts", () => {
    const loanAmount = BN("500e18")
    let originalTBL: BigNumber

    it("Take a loan", async () => {

        const startBalance = await s.USDI.balanceOf(s.Bob.address)
        expect(startBalance).to.eq(0, "Bob holds 0 USDi")

        originalTBL = await s.VaultController.totalBaseLiability()

        await s.VaultController.connect(s.Bob).borrowUSDIto(s.BobVaultID, loanAmount, s.Bob.address)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(loanAmount).to.eq(balance.sub(startBalance), "Bob received correct loan amount")

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.be.closeTo(await toNumber(loanAmount), 0.0001, "liability is correct")

    })

    it("Repay loan and check total base liability", async () => {
        const USDCamount = BN("500e6")
        await s.USDC.connect(s.Bob).approve(s.USDI.address, USDCamount)
        await s.USDI.connect(s.Bob).deposit(USDCamount)
        await mineBlock()

        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await mineBlock()

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.be.closeTo(0, 0.0001, "Loan completely repaid")

        const PostLoanTBL = await s.VaultController.totalBaseLiability()

        expect(PostLoanTBL).to.eq(originalTBL, "Total Base Liability returned to pre-loan levels after repayAll")
    })

    it("Take a big loan and get liquidated", async () => {
        let liability = await s.VaultController.vaultLiability(s.CaroLVaultID)
        expect(await toNumber(liability)).to.eq(0, "0 Liability on Carol's vault")

        const startBalance = await s.USDI.balanceOf(s.Carol.address)

        //originalTBL = await s.VaultController.totalBaseLiability()

        const borrowPower = await s.VaultController.vaultBorrowingPower(s.CaroLVaultID)
        await s.VaultController.connect(s.Carol).borrowUSDIto(s.CaroLVaultID, borrowPower, s.Carol.address)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Carol.address)
        expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(balance.sub(startBalance)), 0.0001, "Carol received correct loan amount")

        liability = await s.VaultController.vaultLiability(s.CaroLVaultID)
        expect(await toNumber(liability)).to.be.closeTo(await toNumber(borrowPower), 0.0001, "liability is correct")


        //Fund dave so he can liquidate
        await s.USDC.connect(s.Dave).approve(s.USDI.address, s.BASE_USDC)
        await s.USDI.connect(s.Dave).deposit(s.BASE_USDC)
        await mineBlock()

        //fast forward to put vault underwater
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await mineBlock()

        //confirm vault is insolvent
        let solvency = await s.VaultController.checkVault(s.CaroLVaultID)
        expect(solvency).to.eq(false, "Carol's vault insolvent")

        balance = await s.UNI.balanceOf(s.Dave.address)
        expect(balance).to.eq(0, "Dvae holds 0 UNI prior to liquidation")

        await s.VaultController.connect(s.Dave).liquidateVault(s.CaroLVaultID, s.UNI.address, BN("999e18"))
        await mineBlock()

        balance = await s.UNI.balanceOf(s.Dave.address)
        expect(balance).to.be.gt(0, "Dave received UNI collateral")

        //repayAll on carol's loan
        const USDCamount = BN("500e6")
        await s.USDC.connect(s.Carol).approve(s.USDI.address, USDCamount)
        await s.USDI.connect(s.Carol).deposit(USDCamount)
        await mineBlock()


        await s.VaultController.connect(s.Carol).repayAllUSDi(s.CaroLVaultID)
        await mineBlock()

        liability = await s.VaultController.vaultLiability(s.CaroLVaultID)
        expect(await toNumber(liability)).to.be.closeTo(0, 0.0001, "Loan completely repaid")


        const PostLiquidationTBL = await s.VaultController.totalBaseLiability()

        expect(PostLiquidationTBL).to.eq(originalTBL, "Total Base Liability returned to pre-loan levels after liquidation and repayAll")

        await s.USDI.connect(s.Dave).withdraw(BN("950e6"))
        await mineBlock()
    })
});

