import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

import { BN } from "../../../util/number";
import {
    ProxyAdmin,
    ProxyAdmin__factory,
    USDI__factory,
    IVault__factory
} from "../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../../util/block";
import { toNumber, getGas } from "../../../util/math";

const usdcAmount = BN("50e6")
const usdiAmount = BN("50e18")

const USDC_BORROW = BN("1000e6")//1k USDC
const USDI_BORROW = BN("100e18")//500 USDI



require("chai").should();
describe("Verify Upgraded Contracts", () => {


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

    it("Check depositTo", async () => {
        await s.USDC.connect(s.Bob).approve(s.USDI.address, usdcAmount)
        await mineBlock()

        await s.USDI.connect(s.Bob).depositTo(usdcAmount, s.Andy.address)
        await mineBlock()

        expect(await s.USDI.balanceOf(s.Andy.address)).to.eq(BN("50e18"), "Andy received the USDI from Bob's deposit")
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

        expect(await s.USDI.balanceOf(s.Carol.address)).to.be.at.least(USDI_BORROW, "Carol received the correct amount of USDI from the second loan")
    })
});

describe("Testing for failure on new USDI functions", () => {
    it("call deposit with amount == 0", async () => {
        //approve
        await s.USDC.connect(s.Dave).approve(s.USDI.address, usdcAmount)
        await mineBlock()

        await expect(s.USDI.connect(s.Dave).deposit(0)).to.be.revertedWith("Cannot deposit 0")
        await mineBlock()
    })

    it("call deposit with an amount that is more than what is posessed", async () => {

        await s.USDC.connect(s.Eric).transfer(s.Bob.address, await s.USDC.balanceOf(s.Eric.address))
        await mineBlock()

        let balance = await s.USDC.balanceOf(s.Eric.address)
        assert.equal(balance.toString(), "0", "Eric holds no USDC")

        //approve
        await s.USDC.connect(s.Eric).approve(s.USDI.address, utils.parseEther("500"))
        await mineBlock()

        await expect(s.USDI.connect(s.Eric).depositTo(utils.parseEther("500"), s.Eric.address)).to.be.revertedWith("ERC20: transfer amount exceeds balance")
        await mineBlock()

    })

    it("Try to withdrawAllTo when holding 0 USDI", async () => {


        let balance = await s.USDI.balanceOf(s.Eric.address)
        expect(balance).to.eq(0, "Eric holds 0 USDi")

        const startUSDC = await s.USDC.balanceOf(s.Eric.address)

        //Eric tries to withdraw way more than should be allowed
        await s.USDI.connect(s.Eric).withdrawAllTo(s.Eric.address)
        await mineBlock()

        expect(await s.USDC.balanceOf(s.Eric.address)).to.eq(startUSDC, "Eric did not receive any USDC")

    })   
})

