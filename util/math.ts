import { s } from "../test/mainnet/scope";
import { BigNumber, Event, utils } from "ethers";
import { ethers } from "hardhat"
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "./block";
import { BN } from "./number";
import { showBody } from "./format";
/**
 * @dev takes interest factor and returns new interest factor - pulls block time from network and latestInterestTime from contract
 * @param interestFactor  - current interest factor read from contract
 * @returns new interest factor based on time elapsed and reserve ratio (read from contract atm)
 */
export const payInterestMath = async (interestFactor: BigNumber) => {

    const nullAddr = "0x0000000000000000000000000000000000000000"

    console.log(s.VaultController.address)

    const latestInterestTime = await s.VaultController.LastInterestTime()//calculate? 
    const currentBlock = await ethers.provider.getBlockNumber()
    const currentTime = (await ethers.provider.getBlock(currentBlock)).timestamp
    let timeDifference = currentTime - latestInterestTime.toNumber() + 1 //account for change when fetching from provider

    const reserveRatio = await s.USDI.reserveRatio()//todo - calculate
    const curve = await s.Curve.getValueAt(nullAddr, reserveRatio)//todo - calculate

    let calculation = BN(timeDifference).mul(BN("1e18").mul(curve))//correct step 1
    calculation = calculation.div(OneYear)//correct step 2 - divide by OneYear
    calculation = calculation.div(BN("1e18"))//truncate
    calculation = calculation.mul(interestFactor)
    calculation = calculation.div(BN("1e18"))//truncate again

    //showBody("Interest Factor increase: ", calculation)
    //showBody("Provided Interest Factor: ", interestFactor)
    //showBody("New Interest Factor: ", interestFactor.add(calculation))

    //new interest factor
    return interestFactor.add(calculation)
}

export const getGas = async (result: any) => {
    const receipt = await result.wait()
    return receipt.gasUsed
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