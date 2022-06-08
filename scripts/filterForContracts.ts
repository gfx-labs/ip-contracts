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
} from "../typechain-types";

import MerkleTree from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"

import { showBody, showBodyCyan } from "../util/format"

import { wave1 } from "../test/scaledWave/data/wave1"
import { wave2 } from "../test/scaledWave/data/wave2"

let whitelist1 = Array.from(wave1)
let whitelist2 = Array.from(wave2)

const { ethers, network, upgrades } = require("hardhat");


const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.rpc.gfx.xyz/"))
const isContract = async (address: string) => {
    const res = await web3.eth.getCode(address)
    return res.length > 5
}

async function sleep(milliseconds: number) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if (new Date().getTime() - start > milliseconds) {
            break;
        }
    }
}

async function write1() {
    const fs = require('fs');

    let path = "wave1Filtered.txt"
    let writeStream = fs.createWriteStream(path);

    writeStream.write("[\n")
    // write each value of the array on the file breaking line
    whitelist1.forEach(value => {
        if (value != undefined) {
            writeStream.write(`\"${value}\",\n`)
        }
    });
    writeStream.write("\n]")
    // the finish event is emitted when all data has been flushed from the stream
    writeStream.on('finish', () => {
        console.log(`wrote all the array data to file ${path}`);
    });

    // handle the errors on the write process
    writeStream.on('error', (err: any) => {
        console.error(`There is an error writing the file ${path} => ${err}`)
    });

    // close the stream
    writeStream.end();
}

async function write2() {
    const fs = require('fs');

    let path = "wave2Filtered.txt"
    let writeStream = fs.createWriteStream(path);

    writeStream.write("[\n")
    // write each value of the array on the file breaking line
    whitelist2.forEach(value => {
        if (value != undefined) {
            writeStream.write(`\"${value}\",\n`)
        }
    });
    writeStream.write("\n]")
    // the finish event is emitted when all data has been flushed from the stream
    writeStream.on('finish', () => {
        console.log(`wrote all the array data to file ${path}`);
    });

    // handle the errors on the write process
    writeStream.on('error', (err: any) => {
        console.error(`There is an error writing the file ${path} => ${err}`)
    });

    // close the stream
    writeStream.end();
}

async function main() {




    showBodyCyan("Scaning wave 1 whitelist for contracts")
    for (let i = 0; i < whitelist1.length; i++) {
        let contract = await isContract(whitelist1[i])
        if (contract) {
            showBody(whitelist1[i], "is a contract, index: ", i)
            delete (whitelist1[i])
        }

    }
    await write1()


    showBodyCyan("Scaning wave 2 whitelist for contracts")
    for (let i = 0; i < whitelist2.length; i++) {
        showBody("checking ", i)
        let contract = await isContract(whitelist2[i])
        if (contract) {
            showBody(whitelist2[i], "is a contract, index: ", i)

            delete (whitelist2[i])
        }

    }
    showBodyCyan("Writing files")

    await write2()

    showBodyCyan("DONE")





}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
