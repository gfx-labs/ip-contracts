import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../util/format";
import { BN } from "../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../util/block";
import { Event, utils, BigNumber } from "ethers";

/**
 * 
 * @param result object returned from a transaction that emits an event 
 * @returns the args from the last event emitted from the transaction
 */
const getArgs = async (result: any) => {
    await advanceBlockHeight(1)
    const receipt = await result.wait()
    await advanceBlockHeight(1)
    const events = receipt.events
    const args = events[events.length - 1].args

    return args
}

const truncate = async (value: BigNumber) => {
    return value.div(BN("1e18"))
}

const calculateBalance = async (interestFactor: BigNumber) => {
    const totalBaseLiability = await s.VaultController._totalBaseLiability()
    const protocolFee = await s.VaultController._protocolFee()

    let valueBefore = await truncate(totalBaseLiability.mul(interestFactor))//check

    const calcInterestFactor = await payInterestMath(interestFactor)//check

    let valueAfter = await truncate(totalBaseLiability.mul(calcInterestFactor))//check

    const protocolAmount = await truncate((valueAfter.sub(valueBefore)).mul(protocolFee))//check
    
    const donationAmount = valueAfter.sub(valueBefore).sub(protocolAmount)
    return donationAmount
}

/**
 * @dev takes interest factor and returns new interest factor - pulls block time from network and latestInterestTime from contract
 * @param interestFactor  - current interest factor read from contract
 * @returns new interest factor based on time elapsed and reserve ratio (read from contract atm)
 */
const payInterestMath = async (interestFactor: BigNumber) => {

    //let interestFactor = await s.VaultController.InterestFactor()

    const latestInterestTime = await s.VaultController._lastInterestTime()//calculate? 
    const currentBlock = await ethers.provider.getBlockNumber()
    const currentTime = (await ethers.provider.getBlock(currentBlock)).timestamp
    let timeDifference = currentTime - latestInterestTime.toNumber() + 1 //account for change when fetching from provider

    const reserveRatio = await s.USDI.reserveRatio()//todo - calculate
    const curve = await s.Curve.getValueAt(nullAddr, reserveRatio)//todo - calculate

    let calculation = BN(timeDifference).mul(BN("1e18").mul(curve))//correct step 1
    calculation = calculation.div(OneYear)//correct step 2 - divide by OneYear
    calculation = await truncate(calculation)//truncate
    calculation = calculation.mul(interestFactor)
    calculation = await truncate(calculation)//truncate again

    //new interest factor
    return interestFactor.add(calculation)
}

/**
 * 
 * @param borrowAmount original borrow amount
 * @param currentInterestFactor current interest factor read from contract 
 * @param initialInterestFactor original interest factor from when borrow took place
 * @returns 
 */
const calculateAccountLiability = async (borrowAmount: BigNumber, currentInterestFactor: BigNumber, initialInterestFactor: BigNumber) => {

    let baseAmount = borrowAmount.mul(BN("1e18"))
    baseAmount = baseAmount.div(initialInterestFactor)
    let currentLiability = baseAmount.mul(currentInterestFactor)
    currentLiability = await truncate(currentLiability)

    return currentLiability
}
const initIF = BN("1e18")
//initIF is 1e18, pay_interest() is called before the first loan is taken, resulting in firstBorrowIF
let firstBorrowIF: BigNumber
const borrowAmount = BN("5000e18")
const nullAddr = "0x0000000000000000000000000000000000000000"
describe("TOKEN-DEPOSITS", async () => {

    //bob tries to borrow usdi against 10 eth as if eth is $100k
    // remember bob has 10 eth
    let actualBorrowAmount: any
    let expectedInterestFactor: BigNumber
    it(`bob should not be able to borrow 1e6 * 1e18 * ${s.Bob_WETH} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrowUsdi(1,
            s.Bob_WETH.mul(BN("1e18")).mul(1e6),
        )).to.be.revertedWith("account insolvent");
    });

    it(`bob should be able to borrow ${"5000e18"} usdi`, async () => {

        const initUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(initUSDiBalance.toString(), "0", "Bob starts with 0 USDi")

        //get initial interest factor
        const initInterestFactor = await s.VaultController.InterestFactor()

        expectedInterestFactor = await payInterestMath(initInterestFactor)
        firstBorrowIF = expectedInterestFactor
        const calculatedBaseLiability = await calculateAccountLiability(borrowAmount, initInterestFactor, initInterestFactor)

        const borrowResult = await s.VaultController.connect(s.Bob).borrowUsdi(1, borrowAmount)
        await advanceBlockHeight(1)
        const args = await getArgs(borrowResult)
        actualBorrowAmount = args!.borrowAmount

        //actual new interest factor from contract
        const newInterestFactor = await s.VaultController.InterestFactor()
        assert.equal(newInterestFactor.toString(), expectedInterestFactor.toString(), "New Interest Factor is correct")

        const liability = await s.VaultController.connect(s.Bob).AccountLiability(1)
        assert.equal(liability.toString(), calculatedBaseLiability.toString(), "Calculated base liability is correct")

        const resultingUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(resultingUSDiBalance.toString(), actualBorrowAmount.toString(), "Bob received the correct amount of USDi")

    });
    it(`after 1 week, bob should have a liability greater than ${"BN(5000e18)"}`, async () => {

        await advanceBlockHeight(1)
        await fastForward(OneWeek)
        await advanceBlockHeight(1)

        let interestFactor = await s.VaultController.InterestFactor()
        const calculatedInterestFactor = await payInterestMath(interestFactor)

        await s.VaultController.connect(s.Frank).calculateInterest();
        await advanceBlockHeight(1)

        interestFactor = await s.VaultController.InterestFactor()
        assert.equal(interestFactor.toString(), calculatedInterestFactor.toString(), "Interest factor is correct")

        const expectedLiability = await calculateAccountLiability(borrowAmount, calculatedInterestFactor, firstBorrowIF)

        //TODO calculate new liability based on interest factor
        const liability_amount = await s
            .VaultController.connect(s.Bob)
            .AccountLiability(1);

        expect(liability_amount).to.be.gt(BN("5000e18"));

        assert.equal(expectedLiability.toString(), liability_amount.toString(), "Liability calculation is correcet")

    });
});

describe("Checking interest generation", () => {
    it("check change in balance over a long period of time", async () => {
        const initBalance = await s.USDI.balanceOf(s.Dave.address)
        //fastForward
        await fastForward(OneYear);//1 year
        await advanceBlockHeight(1)

        //get current interestFactor
        let interestFactor = await s.VaultController.InterestFactor()//check

        const donationAmount = await calculateBalance(interestFactor)//check

        const currentTotalSupply = await s.USDI.totalSupply()
        showBody(currentTotalSupply)



        //check for yeild before calculateInterest - should be 0
        let balance = await s.USDI.balanceOf(s.Dave.address)

        assert.equal(balance.toString(), initBalance.toString(), "No yield before calculateInterest")

        //calculate and pay interest on the contract
        await expect(s.VaultController.calculateInterest()).to.not.reverted
        await advanceBlockHeight(1)

        //check for yeild before calculateInterest - should be 0
        balance = await s.USDI.balanceOf(s.Dave.address)


        //showBody("initialBalance: ", initBalance)
        //showBody("ending balance: ", balance)
        let difference = utils.formatEther(balance.sub(initBalance).toString())
        //showBody(difference)


        expect(balance > initBalance)
    })
})



