import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../util/format";
import { BN } from "../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../util/block";


const usdcAmount = BN("5000e6")

describe("TOKEN-DEPOSITS", async () => {
    it("check starting balance and deposit USDC", async () => {
        const startingUSDCamount = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(startingUSDCamount.toString(), s.Dave_USDC.toString(), "Starting USDC balance is correct")

        const startingUSDIamount = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(startingUSDIamount.toString(), "0", "Starting USDi balance is correct")
        
        await s.USDC.connect(s.Dave).approve(s.USDI.address, usdcAmount)
        const depositResult = await s.USDI.connect(s.Dave).deposit(usdcAmount)
        await mineBlock()
        const depositReceipt = await depositResult.wait()
        const depositArgs = depositReceipt.events![depositReceipt.events!.length - 1]
        assert.equal(depositArgs.event!, "Deposit", "correct event emitted")
        
        let usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(usdcBalance.toString(), s.Dave_USDC.sub(usdcAmount).toString(), "Dave deposited USDC tokens")

        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(usdiBalance.toString(), usdcAmount.mul(1e12).toString(), "USDi balance is correct")

    });

    //fixed bug in withdraw
    it("redeem USDC for USDI", async () => {
        const startingUSDCamount = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(startingUSDCamount.toString(), s.Dave_USDC.sub(usdcAmount).toString(), "Starting USDC balance is correct")
    
        const startingUSDIamount = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(startingUSDIamount.toString(), usdcAmount.mul(1e12).toString(), "Starting USDi balance is correct")
        
        //await s.USDC.connect(s.Dave).approve(s.USDI.address, usdcAmount)
        const withdrawResult = await s.USDI.connect(s.Dave).withdraw(usdcAmount)
        await mineBlock()

        let usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(usdcBalance.toString(), s.Dave_USDC.toString(), "Dave redeemed all USDC tokens")

        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(usdiBalance.toString(), "0", "USDi balance is correct")
    
    });
});