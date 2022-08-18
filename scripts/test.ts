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
    CappedGovToken__factory
} from "../typechain-types";
import { utils, BigNumber } from "ethers";

import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { showBody } from "../util/format";
import { reset, currentBlock } from "../util/block"
import { stealMoney } from "../util/money"

const { ethers, network, upgrades } = require("hardhat");

async function main() {

    const MATIC_ADDR = "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0"
    const MATIC_WHALE = "0xf977814e90da44bfa03b6295a0616a897441acec"

    await reset(15367344)
    const accounts = await ethers.getSigners();

    const deployer = accounts[0];


    for(let i=0; i<accounts.length; i++){
        await stealMoney(MATIC_WHALE, accounts[i].address, MATIC_ADDR, BN("5000e18"))
    }


    const cappedMattic = CappedGovToken__factory.connect("0x5aC39Ed42e14Cf330A864d7D1B82690B4D1B9E61", deployer)
    const underlying = await cappedMattic._underlying()

    if( underlying.toUpperCase() != MATIC_ADDR.toUpperCase()){
        console.log(">>>>>ERROR<<<<<<")
        console.log("UNDERLYING != MATIC")
    }

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
