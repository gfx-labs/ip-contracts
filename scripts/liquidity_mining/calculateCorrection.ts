import { VaultController__factory } from "../../typechain-types/factories/lending/VaultController__factory";
import * as dotenv from "dotenv";
import { AlchemyWebSocketProvider } from "@ethersproject/providers";
import {
    Multicall,
    ContractCallResults,
    ContractCallContext,
} from "ethereum-multicall";
import { CallContext } from "ethereum-multicall/dist/esm/models";
import { ERC20Detailed__factory, IUSDI__factory, IVaultController__factory, Vault__factory } from "../../typechain-types";
import { BigNumber, utils } from "ethers";
import { BN } from "../../util/number";
import Decimal from "decimal.js";
import { BlockRounds } from "./q3_data";
import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { sleep } from "../proposals/suite/proposal";
import { toNumber } from "../../util/math";
import { mergeLists } from "../../util/math";

const GENESIS_BLOCK = 14936125

const threshold = BN("1e18")

dotenv.config();

//const rpc_url =  "https://brilliant.staging.gfx.town" //"https://mainnet.rpc.gfx.xyz/"
const rpc_url = process.env.MAINNET_URL

const USDI_ADDR = "0x2A54bA2964C8Cd459Dc568853F79813a60761B58"

/**
 * PLAN
 * Get true data for first 3 weeks
 * Get totals for each minter from existing data and from new data
 * If existing data total > new data total => do nothing
 * If existing data total < new data total (accounting for new minters) => 
 * New week total is new data total - existing data total (may be 0 for new minters)
 * 
 */

const week2 = require('../../rewardtree/lenders_16345059-16395459_old.json')
const week3 = require('../../rewardtree/lenders_16395460-16445860_old.json')

const week2Adjusted = require("../../rewardtree/lenders_16345059-16395459.json")
const week3Adjusted = require("../../rewardtree/lenders_16395460-16445860.json")
const prepareList = async (list: any) => {

    let LIST: any[] = []


    for (let i = 0; i < list.length; i++) {

        const ZERO = "0x0000000000000000000000000000000000000000"

        if (list[i].minter != ZERO) {
            LIST.push(
                {
                    minter: list[i].minter,
                    amount: Number(list[i].amount)
                }
            )
        }



    }
    return LIST
}

type minter = {
    minter: string
    amount: string
}
const main = async () => {

    //merge existing data
    const formatWeek2 = await prepareList(week2)
    const formatWeek3 = await prepareList(week3)

    const formatWeek2Corrected = await prepareList(week2Adjusted)
    const formatWeek3Corrected = await prepareList(week3Adjusted)

    let mergedListExisting = await mergeLists(formatWeek3, formatWeek2)

    let mergedAdjusted = await mergeLists(formatWeek3Corrected, formatWeek2Corrected)




    //subtract existing from adjusted

    let merged = mergedAdjusted

    for (let i = 0; i < merged.length; i++) {
        for (let j = 0; j < mergedListExisting.length; j++) {
            if (mergedListExisting[j].minter == merged[i].minter) {
                merged[i].amount -= mergedListExisting[j].amount
            }
        }
    }

    //remove negatives

    let finished: minter[] = []

    for (let minter of merged) {

        //console.log(minter.amount.toString())

        if (minter.amount > 0) {

            finished.push({
                minter: minter.minter,
                amount: utils.parseEther(minter.amount.toFixed(18).toString()).toString()
            })
        }
    }




    let formatObject: Record<string, string> = {}


    for (const object of finished) {
        formatObject[object.minter] = object.amount
    }


    //console.log(finished)
    writeFileSync(`rewardtree/adjustment_weeks2-3.json`, JSON.stringify(finished), 'utf8');
    writeFileSync(`rewardtree/adjustment_weeks2-3_FORMAT.json`, JSON.stringify(formatObject), 'utf8');

    console.log("DONE")
    process.exit()
};
main()
