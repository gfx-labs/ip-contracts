import { s } from "./scope";
import { ethers } from "hardhat";
import { BigNumber, Event, utils } from "ethers";
import { expect, assert } from "chai";
import { getGas, getArgs } from "../../util/math"
import { stealMoney } from "../../util/money";
import { showBody, showBodyCyan } from "../../util/format";
import { BN } from "../../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear, reset } from "../../util/block";
import { setMaxListeners } from "events";


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
describe("TESTING USDI CONTRACT", async () => {
    let startingUSDIAmount: BigNumber
    let startBlock: number
    before(async () => {
        startBlock = await ethers.provider.getBlockNumber()
        await mineBlock()
        await fundDave()
        await mineBlock()
    })
    after(async () => {
        //reset to previous block to fix balances
        await reset(startBlock)
    })
    it("check starting balance and deposit USDC", async () => {

        const startingUSDCamount = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(startingUSDCamount.toString(), s.Dave_USDC.toString(), "Starting USDC balance is correct")

        //Dave already holds some USDi at this point
        startingUSDIAmount = await s.USDI.balanceOf(s.Dave.address)

        //approve
        await s.USDC.connect(s.Dave).approve(s.USDI.address, usdcAmount)

        //check pauseable 
        await s.USDI.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.USDI.connect(s.Dave).deposit(usdcAmount)).to.be.revertedWith("Pausable: paused")
        await s.USDI.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        const depositResult = await s.USDI.connect(s.Dave).deposit(usdcAmount)
        await advanceBlockHeight(1)
        const gasUsed = await getGas(depositResult)
        showBodyCyan("Gas cost for Dave deposit: ", gasUsed)

        const depositArgs = await getArgs(depositResult)
        //scale expected USDC amount to 1e18
        assert.equal(depositArgs._value.toString(), usdcAmount.mul(BN("1e12")).toString(), "Deposit amount correct from event receipt")

        //const depositArgs = depositReceipt.events![depositReceipt.events!.length - 1]
        //assert.equal(depositArgs.event!, "Deposit", "correct event emitted")
        let usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(usdcBalance.toString(), s.Dave_USDC.sub(usdcAmount).toString(), "Dave deposited USDC tokens")

        //some interest has accrued, USDI balance should be slightly higher than existingUSDI balance + USDC amount deposited 
        await s.VaultController.calculateInterest()
        await mineBlock();
        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        expect(usdiBalance).to.be.gt(startingUSDIAmount.add(usdcAmount.mul(1e12)))
        //assert.equal(usdiBalance.toString(), startingUSDIamount.add(usdcAmount.mul(1e12)).toString(), "USDi balance is correct")

    });

    //fixed bug in withdraw
    it("redeem USDC for USDI", async () => {

        //check pauseable 
        await s.USDI.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.USDI.connect(s.Dave).withdraw(usdcAmount)).to.be.revertedWith("Pausable: paused")
        await s.USDI.connect(s.Frank).unpause()
        await advanceBlockHeight(1)
        const startingUSDCamount = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(startingUSDCamount.toString(), s.Dave_USDC.sub(usdcAmount).toString(), "Starting USDC balance is correct")

        const withdrawResult = await s.USDI.connect(s.Dave).withdraw(usdcAmount)
        await advanceBlockHeight(1)
        const withdrawGas = await getGas(withdrawResult)
        showBodyCyan("Gas cost for Dave to withdraw: ", withdrawGas)

        let usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(usdcBalance.toString(), s.Dave_USDC.toString(), "Dave redeemed all USDC tokens")

        //Return Dave to his original amount of USDi holdings
        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        //should end up with slightly more USDI than original due to interest 
        expect(usdiBalance).to.be.gt(startingUSDIAmount)
    });

    it("Withdraw total reserves", async () => {


        /**
         * Dave should loose USDI and gain USDC
         */




        const usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        let formatUSDC = utils.formatEther(usdcBalance.mul(BN("1e12")).toString())
        const usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        const reserve = await s.USDC.balanceOf(s.USDI.address)
        const reserve_e18 = reserve.mul(BN("1e12"))
        let formatReserve = utils.formatEther(reserve_e18.toString())

        showBody("Reserve: ", reserve)
        showBody(reserve_e18.toString())


        /**
         showBody("Dave's USDI Balance: : ", utils.formatEther(usdiBalance.toString()))
        showBody("Dave's raw USDI bal  : ", usdiBalance)
        showBody("Dave's USDC Balance: : ", usdcBalance)
        showBody("Dave's USDC format   : ", formatUSDC)
        showBody("Reserve amount USDC  : ", reserve)
        showBody("Reserve format 1e18  : ", formatReserve)
         */

        //let reserve_e18 = reserve.mul(BN("1e18"))
        //let formatReserve = utils.formatEther(reserve_e18.toString())

        //const withdrawResult = await s.USDI.connect(s.Dave).withdraw(reserve)
        const withdrawResult = await s.USDI.connect(s.Dave).withdraw_all()
        await mineBlock()
        const withdrawGas = await getGas(withdrawResult)
        const withdrawArgs = await getArgs(withdrawResult)
        assert.equal(withdrawArgs._value.toString(), reserve_e18.toString(), "Withdrawl amount correct on event receipt")
        showBodyCyan("withdraw all gas: ", withdrawGas)


        let ending_usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        formatUSDC = utils.formatEther(ending_usdcBalance.mul(BN("1e12")).toString())
        let ending_usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        const end_reserve = await s.USDC.balanceOf(s.USDI.address)
        const end_reserve_e18 = reserve.mul(BN("1e12"))
        formatReserve = utils.formatEther(end_reserve_e18.toString())
        /**
         showBody("Dave's USDI Balance: : ", utils.formatEther(ending_usdiBalance.toString()))
        showBody("Dave's raw USDI bal  : ", ending_usdiBalance)
        showBody("Dave's USDC Balance: : ", ending_usdcBalance)
        showBody("Dave's USDC format   : ", formatUSDC)
        showBody("Reserve amount USDC  : ", end_reserve)
        showBody("Reserve format 1e18  : ", formatReserve)
         */


        //verify things
        //const expectedUSDIamount = usdiBalance.sub(reserve)
        const expectedUSDCamount = usdcBalance.add(reserve)
        assert.equal(expectedUSDCamount.toString(), ending_usdcBalance.toString(), "Expected USDC balance is correct")
        const expectedUSDIamount = usdiBalance.sub(reserve_e18)
        const difference = ending_usdiBalance.sub(expectedUSDIamount)

        //TODO calculate interest over time to pre determine difference
        expect(difference).to.be.gt(BN("0"))
        expect(difference).to.be.lt(BN("51515426655222589"))
        
        assert.equal(end_reserve.toString(), "0", "reserve is empty")

        //cannot withdraw when reserve is empty
        await expect(s.USDI.connect(s.Dave).withdraw(1)).to.be.reverted
        await expect(s.USDI.connect(s.Dave).withdraw_all()).to.be.revertedWith("Reserve is empty")
        
    })
    it("Anyone can donate USDC to the protocol", async () => {
        let balance = await s.USDC.balanceOf(s.Dave.address)
        let reserve = await s.USDC.balanceOf(s.USDI.address)

        assert.equal(reserve.toString(), "0", "reserve is 0, donations welcome :)")

        //todo check totalSupply and confirm interest rate changes

        //Dave approves and donates half of his USDC
        await s.USDC.connect(s.Dave).approve(s.USDI.address, balance.div(2))
        const donateResult = await s.USDI.connect(s.Dave).donate(balance.div(2))
        await advanceBlockHeight(1)
        const donateGas = await getGas(donateResult)
        showBodyCyan("Gas cost to donate: ", donateGas)


        let updatedBalance = await s.USDC.balanceOf(s.Dave.address)
        let updatedReserve = await s.USDC.balanceOf(s.USDI.address)

        assert.equal(updatedBalance.toString(), updatedReserve.toString(), "Donate successful")

    })

});
