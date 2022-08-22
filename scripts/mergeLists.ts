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

const { ethers, network, upgrades } = require("hardhat");

const LPS = require('../rewardtree/lps_15320238-15365038.json')
const BORROWERS = require('../rewardtree/borrowers_15320238-15365038.json')


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

    let formatLPS = await prepareList(LPS)

    let formatBORROW = await prepareList(BORROWERS)


    let mergedList = await mergeLists(formatBORROW, formatLPS)

    let valueAdjusted: any[] = []

    for (let minter of mergedList) {

        //console.log(minter.amount.toString())

        valueAdjusted.push({
            minter: minter.minter,
            amount: utils.parseEther(minter.amount.toFixed(18).toString()).toString()
        })

    }

    writeFileSync(`rewardtree/mergedAndFormatWeek8.json`, JSON.stringify(valueAdjusted), 'utf8')
}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
