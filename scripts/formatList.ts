import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Deployment, DeploymentInfo } from "./deployment/deployment";
import {
    CurveMaster__factory,
    OracleMaster__factory,
    ThreeLines0_100__factory,
    UniswapV3OracleRelay__factory,
    VaultController__factory,
    CappedGovToken__factory,
    IOracleRelay__factory
} from "../typechain-types";
import { utils, BigNumber } from "ethers";

import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { showBody } from "../util/format";
import { reset, currentBlock } from "../util/block"
import { stealMoney } from "../util/money"
import exp from "constants";
import { expect } from "chai";
import * as readline from 'node:readline';
import { stdin, stdout } from 'process';
import { mergeLists } from "../util/math"
import { each } from "underscore";
import { min } from "bn.js";
import { writeFileSync } from "fs";
import { json } from "stream/consumers";

const { ethers, network, upgrades } = require("hardhat");

const LPS = require('../rewardtree/adjustment_weeks2-3.json')
//const BORROWERS = require('../rewardtree/borrowers_15639445-15689845.json')
const BORROWERS = LPS


//for format minter:amount  ===>> {minter: minter, amount: amount}
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

//LPS: JSON, borrowers: JSON
async function main() {
    console.log("Start")
    let formatLPS = await prepareList(LPS)

    console.log("Prepared list")

    //let formatBORROW = await prepareList(BORROWERS)


    //let mergedList = await mergeLists(formatBORROW, formatLPS)
    //let mergedList = formatLPS

    //console.log("Merged list", mergedList)

    let valueAdjusted: any[] = []

    for (let minter of LPS) {

        //console.log(minter.amount.toString())

        console.log("Pushing: ", minter.amount)


        valueAdjusted.push({
            minter: minter.minter,
            amount: minter.amount//utils.parseEther(minter.amount.toFixed(18).toString()).toString()
        })

    }

    console.log(valueAdjusted)

    let formatObject: Record<string, string> = {}


    for(const object of valueAdjusted){
        formatObject[object.minter] = object.amount
    }

    //writeFileSync(`rewardtree/mergedAndFormatWeek155.json`, JSON.stringify(valueAdjusted), 'utf8')
    writeFileSync(`rewardtree/week305Object.json`, JSON.stringify(formatObject), 'utf8')

}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
