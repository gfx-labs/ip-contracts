import { network } from "hardhat";
import hre from 'hardhat';
import { currentBlock, resetCurrent, resetCurrentOP } from "../../../util/block";
import { s } from "./scope";
import {Deployment, DeploymentInfo} from "./optimisimDeployment"
import { ProxyAdmin } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { ProxyAdmin__factory } from "../../../typechain-types";
import { OptimisimAddresses } from "../../../util/addresser";
const { ethers } = require("hardhat");

async function main() {

    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST DEPLOYMENT: ", networkName)
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        const block = await currentBlock()
        console.log("Deploying on OPTIMISM as of block: ", block.number)
    } else {
        console.log("DEPLOYING TO: ", networkName)
    }
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    console.log("Deployer: ", deployer.address)

    let info:DeploymentInfo = {
        //external contracts
        WETH: s.wethAddress,
        OP: s.opAddress,
        USDC: s.usdcAddress,
        WBTC: s.wbtcAddress,
        AAVE: s.aaveAddress,
        UNI: s.uniAddress
    }

    const d = new Deployment(deployer, info)
    await d
        .ensure()
        .then(() => {
            console.log("Contracts Deployed")
        })
        .catch((e) => {
            console.log(e)
        })
}


//hh node --fork https://opt-mainnet.g.alchemy.com/v2/QSB8Y8bsGwYbdKg_EAABl0VTRBa1ymHp  --fork-block-number 105288452
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

