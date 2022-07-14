import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
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


require("chai").should();
describe("Verify Upgraded Contracts", () => {

    const usdcAmount = BN("50e6")
    const usdiAmount = BN("50e18")

    const USDC_BORROW = BN("1000e6")//1k USDC
    const USDI_BORROW = BN("100e18")//500 USDI


    it("Confirm USDI now has the upgraded functions", async () => {

        //depositTo() does not exist, revert without reason string
        await s.USDC.connect(s.Bob).approve(s.USDI.address, usdcAmount)
        await s.USDI.connect(s.Bob).depositTo(usdcAmount, s.Bob.address)
        await mineBlock()

        expect(await toNumber(await s.USDI.balanceOf(s.Bob.address))).to.be.closeTo(await toNumber(usdiAmount), 0.001, "Bob received USDI using the new function")


        //Confirm deposit still works too
        await s.USDC.connect(s.Bob).approve(s.USDI.address, usdcAmount)
        await s.USDI.connect(s.Bob).deposit(usdcAmount)
        await mineBlock()

        expect(await toNumber(await s.USDI.balanceOf(s.Bob.address))).to.be.closeTo(await toNumber(usdiAmount.mul(2)), 0.001, "Bob received USDI using the pre existing function")

        await s.USDI.connect(s.Bob).withdrawTo(usdcAmount.div(2), s.Bob.address)
        await mineBlock()
        await s.USDI.connect(s.Bob).withdraw(usdcAmount.div(2))
        await mineBlock()
        expect(await toNumber(await s.USDI.balanceOf(s.Bob.address))).to.be.closeTo(await toNumber(usdiAmount), 0.001, "Bob is able to withdraw using withdraw and withdrawTo functions")

        await s.USDI.connect(s.Bob).withdrawAllTo(s.Bob.address)
        await mineBlock()

        expect(await toNumber(await s.USDI.balanceOf(s.Bob.address))).to.be.closeTo(0, 0.0001, "Bob is able to withdraw using the new withdrawAllTo function")

        //deposit some more to test withdrawAll()
        await s.USDC.connect(s.Bob).approve(s.USDI.address, usdcAmount)
        await s.USDI.connect(s.Bob).deposit(usdcAmount)
        await mineBlock()

        await s.USDI.connect(s.Bob).withdrawAll()
        await mineBlock()

        expect(await toNumber(await s.USDI.balanceOf(s.Bob.address))).to.be.closeTo(0, 0.0001, "Bob is able to withdraw using the new withdrawAll function")

    })

    it("Confirm VaultController now has borrowUSDCto", async () => {
        const startUSDC = await s.USDC.balanceOf(s.Bob.address)
        //bob borrows USDC
        const result = await s.VaultController.connect(s.Bob).borrowUSDCto(s.BobVaultID, USDC_BORROW, s.Bob.address)
        await mineBlock()

        const gas = await getGas(result)
        showBodyCyan("Gas to borrow USDC: ", gas)

        const endUSDC = await s.USDC.balanceOf(s.Bob.address)
        let difference = endUSDC.sub(startUSDC)
        expect(difference).to.eq(USDC_BORROW, "Change in USDC balance after borrow is correct")

        //check liability
        let liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.eq(USDC_BORROW.div(BN("1e6")), "Liability matches borrow amount")
    })

    it("Confirm VaultController now has borrowUSDIto", async () => {

        expect(await s.USDI.balanceOf(s.Carol.address)).to.eq(0, "Carol holds 0 USDI")

        const borrowPower = await s.VaultController.vaultBorrowingPower(s.CaroLVaultID)
        expect(borrowPower).to.be.gt(USDI_BORROW.mul(2), "There is enough borrow power for 2 loans")

        const result = await s.VaultController.connect(s.Carol).borrowUSDIto(s.CaroLVaultID, USDI_BORROW, s.Carol.address)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to borrow USDI: ", gas)

        expect(await s.USDI.balanceOf(s.Carol.address)).to.eq(USDI_BORROW, "Carol received the correct amount of USDI")

        await s.VaultController.connect(s.Carol).borrowUsdi(s.CaroLVaultID, USDI_BORROW)
        await mineBlock()

        expect(await s.USDI.balanceOf(s.Carol.address)).to.be.gt(USDI_BORROW.mul(2), "Carol received the correct amount of USDI from the second loan")
    })
});

