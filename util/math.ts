import { s } from "../test/mainnet/scope";
import { BigNumber, Event, utils } from "ethers";
import { ethers } from "hardhat"
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "./block";
import { BN } from "./number";
import { showBody } from "./format";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

/**
 * @dev takes interest factor and returns new interest factor - pulls block time from network and latestInterestTime from contract
 * @param interestFactor  - current interest factor read from contract
 * @returns new interest factor based on time elapsed and reserve ratio (read from contract atm)
 */
 export const payInterestMath = async (interestFactor: BigNumber) => {
    const nullAddr = "0x0000000000000000000000000000000000000000"

    /**
     * get interest factor from contract
     * //time passes
     * run payInterestMath to get new interest factor
     * calculate_interest()
     * get interest factor from contract
     * should match interestFactor calculated in payInterestMath
     * after confirming they match, use calculated interest factor go calc balance, liability, etc
     */

    //let interestFactor = await s.VaultController.InterestFactor()

    const latestInterestTime = await s.VaultController.LastInterestTime()//calculate? 
    const currentBlock = await ethers.provider.getBlockNumber()
    const currentTime = (await ethers.provider.getBlock(currentBlock)).timestamp
    await nextBlockTime(currentTime)
    //await network.provider.send("evm_mine")

    let timeDifference = currentTime - latestInterestTime.toNumber() + 1 //new block must have time ++1

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
 * @note proper procedure: read interest factor from contract -> elapse time -> call this to predict balance -> pay_interest() -> compare 
 * @param interestFactor CURRENT interest factor read from contract before any time has elapsed
 * @param user whose balance to calculate interest on? 
 * @returns expected balance after pay_interest()
 */
 export const calculateBalance = async (interestFactor: BigNumber, user: SignerWithAddress) => {
    const totalBaseLiability = await s.VaultController._totalBaseLiability()
    const protocolFee = await s.VaultController._protocolFee()

    let valueBefore = await truncate(totalBaseLiability.mul(interestFactor))

    const calcInterestFactor = await payInterestMath(interestFactor)

    let valueAfter = await truncate(totalBaseLiability.mul(calcInterestFactor))
    const protocolAmount = await truncate((valueAfter.sub(valueBefore)).mul(protocolFee))

    const donationAmount = valueAfter.sub(valueBefore).sub(protocolAmount)//wrong
    const currentTotalSupply = await s.USDI.totalSupply()
    let newSupply = currentTotalSupply.add(donationAmount)

    //totalGons
    const totalGons = await s.USDI._totalGons()

    //gpf
    const gpf = totalGons.div(newSupply)

    //calculate balance 
    //get gon balance - calculate? 
    const gonBalance = await s.USDI.scaledBalanceOf(user.address)

    const expectedBalance = gonBalance.div(gpf)
    return expectedBalance
}
/**
 * @note WIP - TODO: FIX: Actual: 100,000,124,079,046,156,741 predicted: 100,000,309,438,951,680,015
 * @note proper procedure: read interest factor from contract -> elapse time -> call this to predict balance -> pay_interest() -> compare 
 * @param interestFactor CURRENT interest factor read from contract before any time has elapsed
 * @param user starting amount
 * @returns expected amount after interest is paid
 */
export const changeInBalance = async (interestFactor: BigNumber, amount: BigNumber) => {
    const totalBaseLiability = await s.VaultController._totalBaseLiability()
    const protocolFee = await s.VaultController._protocolFee()

    let valueBefore = await truncate(totalBaseLiability.mul(interestFactor))

    const calcInterestFactor = await payInterestMath(interestFactor)

    let valueAfter = await truncate(totalBaseLiability.mul(calcInterestFactor))
    const protocolAmount = await truncate((valueAfter.sub(valueBefore)).mul(protocolFee))

    const donationAmount = valueAfter.sub(valueBefore).sub(protocolAmount)//wrong
    const currentTotalSupply = await s.USDI.totalSupply()
    let newSupply = currentTotalSupply.add(donationAmount)

    //totalGons
    const totalGons = await s.USDI._totalGons()

    //gpf
    const startingGPF = totalGons.div(currentTotalSupply)
    const gpf = totalGons.div(newSupply)

    //calculate balance 
    //get gon balance - calculate? 
    const gonBalance = amount.mul(startingGPF)           //await s.USDI.scaledBalanceOf(user.address)

    const expectedBalance = gonBalance.div(gpf)
    return expectedBalance
}

/**
 * 
 * @param borrowAmount original borrow amount
 * @param currentInterestFactor current interest factor read from contract 
 * @param initialInterestFactor original interest factor from when borrow took place
 * @returns 
 */
 export const calculateAccountLiability = async (borrowAmount: BigNumber, currentInterestFactor: BigNumber, initialInterestFactor: BigNumber) => {

    let baseAmount = borrowAmount.mul(BN("1e18"))
    baseAmount = baseAmount.div(initialInterestFactor)
    let currentLiability = baseAmount.mul(currentInterestFactor)
    currentLiability = await truncate(currentLiability)

    return currentLiability
}

export const getGas = async (result: any) => {
    const receipt = await result.wait()
    return receipt.gasUsed
}

export const truncate = async (value: BigNumber) => {
    return value.div(BN("1e18"))
}

export const getEvent = async (result: any, event: string) => {
    const receipt = await result.wait()
    let parsedEvent = receipt.events?.filter((x: Event) => {
        return x.event == event
    }).pop()//?.event//get just event name
    return parsedEvent
}

/**
 * 
 * @param result object returned from a transaction that emits an event 
 * @returns the args from the last event emitted from the transaction
 */
export const getArgs = async (result: any) => {
    await advanceBlockHeight(1)
    const receipt = await result.wait()
    await advanceBlockHeight(1)
    const events = receipt.events
    const args = events[events.length - 1].args

    return args
}