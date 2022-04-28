import { s } from "./scope";
import { ethers } from "hardhat";
import { BigNumber, Event, utils } from "ethers";
import { expect, assert } from "chai";
import { getGas, getArgs, calculateBalance, changeInBalance } from "../../util/math"
import { stealMoney } from "../../util/money";
import { showBody, showBodyCyan } from "../../util/format";
import { BN } from "../../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear, reset } from "../../util/block";
import { setMaxListeners } from "events";
import { start } from "repl";


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
        //await reset(startBlock)
    })

    //check admin functions
    it("check admin mint", async () => {
        await mineBlock()


        const smallAmount = utils.parseEther("100")
        const smallAmount_e6 = smallAmount.div(BN("1e12"))
        const startBalance = await s.USDI.balanceOf(s.Frank.address)


        //test for eronious input
        //should revert if not the admin
        await expect(s.USDI.connect(s.Bob).mint(smallAmount_e6)).to.be.reverted
        await expect(s.USDI.connect(s.Frank).mint(0)).to.be.reverted


        const mintResult = await s.USDI.connect(s.Frank).mint(smallAmount_e6)
        await advanceBlockHeight(1)
        const mintArgs = await getArgs(mintResult)
        assert.equal(mintArgs._value.toString(), smallAmount.toString(), "Correct amount minted from event receipt")

        const mintGas = await getGas(mintResult)
        showBodyCyan("Gas cost to mint: ", mintGas)


        let balance = await s.USDI.balanceOf(s.Frank.address)

        let difference = balance.sub(startBalance)

        //expect balance to be increased by smallAmount + interest -> TODO calc interest on smallAmount
        expect(difference).to.be.gt(smallAmount)

        //assert.equal(balance.toString(), (startBalance.add(smallAmount)).toString(), `Frank has ${utils.formatEther(smallAmount)} more USDi`)

    })
    it("check admin burn", async () => {
        const smallAmount = utils.parseEther("100")
        const smallAmount_e6 = smallAmount.div(BN("1e12"))
        const startBalance = await s.USDI.balanceOf(s.Frank.address)


        //test for eronious input
        //should revert if not the admin
        await expect(s.USDI.connect(s.Bob).burn(smallAmount_e6)).to.be.reverted
        await expect(s.USDI.connect(s.Frank).burn(0)).to.be.reverted

        //should revert if not the admin

        const burnResult = await s.USDI.connect(s.Frank).mint(smallAmount_e6)
        await advanceBlockHeight(1)
        const burnArgs = await getArgs(burnResult)
        assert.equal(burnArgs._value.toString(), smallAmount.toString(), "Correct amount burned from event receipt")

        let balance = await s.USDI.balanceOf(s.Frank.address)
        let difference = balance.sub(startBalance)

        //expect balance to be decreased by smallAmount - interest -> TODO calc interest on smallAmount
        expect(difference).to.be.gt(smallAmount)
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

    it("call deposit with amount == 0", async () => {

        //approve
        await s.USDC.connect(s.Dave).approve(s.USDI.address, usdcAmount)
        await mineBlock()

        await expect(s.USDI.connect(s.Dave).deposit(0)).to.be.revertedWith("Cannot deposit 0")
        await mineBlock()
    })

    it("call deposit with an amount that is more than what is posessed", async () => {
        let balance = await s.USDC.balanceOf(s.Eric.address)
        assert.equal(balance.toString(), "0", "Eric holds no USDC")

        //approve
        await s.USDC.connect(s.Eric).approve(s.USDI.address, utils.parseEther("500"))
        await mineBlock()

        await expect(s.USDI.connect(s.Eric).deposit(utils.parseEther("500"))).to.be.revertedWith("ERC20: transfer amount exceeds balance")
        await mineBlock()

    })

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

    it("Handles eronious withdrawl amounts, and USDi transfer", async () => {
        let startingUSDIbalance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(startingUSDIbalance.toString(), "0", "Eric does not hold any USDi")

        const smallAmount = utils.parseEther("1")
        const smallAmount_e6 = smallAmount.div(BN("1e12"))
        const tryAmount = smallAmount_e6.mul(5)
        const reserve = await s.USDC.balanceOf(s.USDI.address)

        await mineBlock()
        const transferResult = await s.USDI.connect(s.Dave).transfer(s.Eric.address, smallAmount)
        await mineBlock()
        const transferGas = await getGas(transferResult)
        showBodyCyan("Gas cost to transfer USDi: ", transferGas)

        let balance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(balance.toString(), smallAmount.toString(), "Balance is correct")

        //Eric tries to withdraw way more than should be allowed
        await expect(s.USDI.connect(s.Eric).withdraw(tryAmount)).to.be.revertedWith("insufficient funds")

    })

    it("Withdraw total reserves", async () => {

        const usdcBalance = await s.USDC.balanceOf(s.Dave.address)
        let formatUSDC = utils.formatEther(usdcBalance.mul(BN("1e12")).toString())
        const usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        const reserve = await s.USDC.balanceOf(s.USDI.address)
        const reserve_e18 = reserve.mul(BN("1e12"))
        let formatReserve = utils.formatEther(reserve_e18.toString())

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


        //verify things
        //const expectedUSDIamount = usdiBalance.sub(reserve)
        const expectedUSDCamount = usdcBalance.add(reserve)
        assert.equal(expectedUSDCamount.toString(), ending_usdcBalance.toString(), "Expected USDC balance is correct")
        const expectedUSDIamount = usdiBalance.sub(reserve_e18)
        const difference = ending_usdiBalance.sub(expectedUSDIamount)

        //TODO calculate interest over time to pre determine difference
        //expect(difference).to.be.gt(BN("0"))
        //expect(difference).to.be.lt(BN("51515426655222589"))

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

    it("what happens when someone simply transfers ether to USDi contract? ", async () => {

        let tx = {
            to: s.USDI.address,
            value: utils.parseEther("1")
        }
        await expect(s.Dave.sendTransaction(tx)).to.be.reverted
        await mineBlock()
    })


    /**
     * when sending USDC to USDi contract accidently, the reserve ratio responds, and the USDC goes to the reserve
     * the only way for the USDC to leave the reserve is if the reserve is sufficiently depleated
     * 
     * donations to the USDi protocol should ideally go through the donate function
     */
    it("what happens when someone accidently transfers USDC to the USDi contract? ", async () => {
        const startingReserve = await s.USDC.balanceOf(s.USDI.address)
        const startingReserveRatio = await s.USDI.reserveRatio()
        const startingSupply = await s.USDI.totalSupply()

        //eroniouisly transfer USDC to USDi contract
        const smallAmount = utils.parseEther("1")
        const smallAmount_e6 = smallAmount.div(BN("1e12"))//1 USDC = 1,000,000

        await mineBlock()
        await s.USDC.connect(s.Dave).transfer(s.USDI.address, smallAmount_e6)
        await mineBlock()

        let reserve = await s.USDC.balanceOf(s.USDI.address)
        let reserveRatio = await s.USDI.reserveRatio()
        let totalSupply = await s.USDI.totalSupply()

        assert.equal(startingSupply.toString(), totalSupply.toString(), "Total supply has not changed, no USDi minted")
        expect(reserve).to.be.gt(startingReserve)//USDC received and is in the reserve
        expect(reserveRatio).to.be.gt(startingReserveRatio)//reserve ratio increased
    })

});
