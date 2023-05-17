import { s } from "../scope";
import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { getGas, getArgs, toNumber} from "../../../../util/math"
import { stealMoney } from "../../../../util/money";
import { showBody, showBodyCyan } from "../../../../util/format";
import { BN } from "../../../../util/number";
import { advanceBlockHeight, mineBlock} from "../../../../util/block";

const usdcAmount = BN("5000e6")

const fundDave = async () => {
    let usdc_minter = "0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2";
    //showBody(`stealing ${s.Dave_USDC} to dave from ${s.usdcAddress}`)
    await stealMoney(
        usdc_minter,
        s.Dave.address,
        s.usdcAddress,
        BN("100000e6")
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
    it("check starting balance and deposit USDC", async () => {

        //Dave already holds some USDi at this point
        startingUSDIAmount = await s.USDI.balanceOf(s.Dave.address)

        //approve
        await s.USDC.connect(s.Dave).approve(s.USDI.address, usdcAmount)
        await advanceBlockHeight(1)


        const depositResult = await s.USDI.connect(s.Dave).deposit(usdcAmount)
        await advanceBlockHeight(1)
        const gasUsed = await getGas(depositResult)
        showBodyCyan("Gas cost for Dave deposit: ", gasUsed)

        const depositArgs = await getArgs(depositResult)
        //scale expected USDC amount to 1e18
        assert.equal(depositArgs._value.toString(), usdcAmount.mul(BN("1e12")).toString(), "Deposit amount correct from event receipt")

        //some interest has accrued, USDi balance should be slightly higher than existingUSDi balance + USDC amount deposited 
        await s.VaultController.calculateInterest()
        await mineBlock();
        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        expect(usdiBalance).to.be.gt(startingUSDIAmount.add(usdcAmount.mul(1e12)))
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
        const withdrawResult = await s.USDI.connect(s.Dave).withdraw(usdcAmount)
        await advanceBlockHeight(1)
        const withdrawGas = await getGas(withdrawResult)
        showBodyCyan("Gas cost for Dave to withdraw: ", withdrawGas)

        //Return Dave to his original amount of USDi holdings
        let usdiBalance = await s.USDI.balanceOf(s.Dave.address)
        //should end up with slightly more USDI than original due to interest 
        expect(usdiBalance).to.be.gt(startingUSDIAmount)
    });

    it("Anyone can donate USDC to the protocol", async () => {
     
        let balance = await s.USDC.balanceOf(s.Dave.address)
        //Dave approves and donates half of his USDC
        await s.USDC.connect(s.Dave).approve(s.USDI.address, balance.div(2))
        const donateResult = await s.USDI.connect(s.Dave).donate(balance.div(2))
        await advanceBlockHeight(1)
        const donateGas = await getGas(donateResult)
        showBodyCyan("Gas cost to donate: ", donateGas)
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
     * 
     * eronious donations can be rebased into the the custody of all USDi holders by governance via the donateReserve() function
     * see ../isolated/noReserve for testing of this scenario
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
        expect(reserve).to.be.gt(startingReserve.sub(1))//USDC received and is in the reserve
        expect(reserveRatio).to.be.gt(startingReserveRatio.sub(1))//reserve ratio increased
    })

});
