import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../util/format";
import { BN } from "../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../util/block";
//TODO

const ERC20ABI = require('../../scripts/erc20ABI.ts')
const abi = new ERC20ABI()
const USDC_Contract = new ethers.Contract(s.usdcAddress, abi.erc20ABI(), ethers.provider)
const usdcAmount = BN("5000e6")

describe("TOKEN-DEPOSITS", async () => {
    //bob tries to borrow usdi against 10 eth as if eth is $100k
    // remember bob has 10 eth
    it(`bob should not be able to borrow 1e6 * 1e18 * ${s.Bob_WETH} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrow_usdi(1,
            s.Bob_WETH.mul(BN("1e18")).mul(1e6),
        )).to.be.revertedWith("account insolvent");
    });

    it("check starting balance and deposit USDC", async () => {
        const startingUSDCamount = await USDC_Contract.balanceOf(s.Dave.address)
        assert.equal(startingUSDCamount.toString(), s.Dave_USDC.toString(), "Starting USDC balance is correct")

        const startingUSDIamount = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(startingUSDIamount.toString(), "0", "Starting USDi balance is correct")

        //approve and deposit 5000 USDC
        
        await USDC_Contract.connect(s.Dave).approve(s.USDI.address, usdcAmount)
        const depositResult = await s.USDI.connect(s.Dave).deposit(usdcAmount)
        await mineBlock()
        const depositReceipt = await depositResult.wait()
        const depositArgs = depositReceipt.events![depositReceipt.events!.length - 1]
        assert.equal(depositArgs.event!, "Deposit", "correct event emitted")
        
        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(usdiBalance.toString(), usdcAmount.mul(1e12).toString(), "USDi balance is correct")

    });
    it("redeem USDC for USDI", async () => {
        const startingUSDCamount = await USDC_Contract.balanceOf(s.Dave.address)
        assert.equal(startingUSDCamount.toString(), s.Dave_USDC.sub(usdcAmount).toString(), "Starting USDC balance is correct")
    
        const startingUSDIamount = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(startingUSDIamount.toString(), usdcAmount.mul(1e12).toString(), "Starting USDi balance is correct")
    
        const withdrawResult = await s.USDI.connect(s.Dave).withdraw(usdcAmount)
    
    });
});