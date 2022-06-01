import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CurveMaster__factory,
    ThreeLines0_100__factory,
    OracleMaster__factory,
    OracleMaster
} from "../typechain-types";

const { ethers, network, upgrades } = require("hardhat");

const pool = "0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6"
const omAddr = "0x90a972d9b53659150F1412E885E27fb7c2E49110"


async function main() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const oracle = new OracleMaster__factory(deployer).attach(omAddr)
    console.log(`found OracleMaster at ${omAddr}`);
    
    




}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
