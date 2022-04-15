import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { stealMoney } from "../util/money";
import { showBody } from "../util/format";
import { BN } from "../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../util/block";


const usdcAmount = BN("5000e6")

const fundDave = async () => {
    let usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";
    //showBody(`stealing ${s.Dave_USDC} to dave from ${s.usdcAddress}`)
    await stealMoney(
        usdc_minter,
        s.Dave.address,
        s.usdcAddress,
        s.Dave_USDC
    )
}

//set balances

describe("TOKEN-DEPOSITS", async () => {
    before(async () => {
        await mineBlock()
        await fundDave()
        await mineBlock()
    })
    it("check starting balance and deposit USDC", async () => {

        const startingUSDCamount = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(startingUSDCamount.toString(), s.Dave_USDC.toString(), "Starting USDC balance is correct")

        //Dave already holds some USDi at this point
        const startingUSDIamount = await s.USDI.balanceOf(s.Dave.address)

        await s.USDC.connect(s.Dave).approve(s.USDI.address, usdcAmount)
        const depositResult = await s.USDI.connect(s.Dave).deposit(usdcAmount)
        await mineBlock()
        const depositReceipt = await depositResult.wait()
        const depositArgs = depositReceipt.events![depositReceipt.events!.length - 1]
        assert.equal(depositArgs.event!, "Deposit", "correct event emitted")

        let usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(usdcBalance.toString(), s.Dave_USDC.sub(usdcAmount).toString(), "Dave deposited USDC tokens")

        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(usdiBalance.toString(), startingUSDIamount.add(usdcAmount.mul(1e12)).toString(), "USDi balance is correct")

    });

    //fixed bug in withdraw
    it("redeem USDC for USDI", async () => {
        const startingUSDCamount = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(startingUSDCamount.toString(), s.Dave_USDC.sub(usdcAmount).toString(), "Starting USDC balance is correct")

        const startingUSDIamount = await s.USDI.balanceOf(s.Dave.address)

        const withdrawResult = await s.USDI.connect(s.Dave).withdraw(usdcAmount)
        await mineBlock()

        let usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(usdcBalance.toString(), s.Dave_USDC.toString(), "Dave redeemed all USDC tokens")

        //Return Dave to his original amount of USDi holdings
        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(usdiBalance.toString(), startingUSDIamount.sub(usdcAmount.mul(1e12)).toString(), "USDi balance is correct")

    });
});