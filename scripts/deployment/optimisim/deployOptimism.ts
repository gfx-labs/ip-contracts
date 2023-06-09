import { network } from "hardhat";
import hre from 'hardhat';
import { currentBlock, resetCurrentOP } from "../../../util/block";
import { s } from "./scope";
import { Deployment, DeploymentInfo } from "./optimisimDeployment";
import { BN } from "../../../util/number";
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

    let info: DeploymentInfo = {

        //token parameters
        WethLTV: BN("85e16"),
        WethLiqInc: BN("5e18"),

        wBtcLTV: BN("85e16"),
        wBtcLiqInc: BN("5e18"),

        OpLTV: BN("85e16"),
        OpLiqInc: BN("5e18"),
        OpCap: BN("725000e18"), //1mm cap

        wstEthLTV: BN("85e16"),
        wstEthLiqInc: BN("5e18"),
        wstEthCap: BN("500e18"),//1mm cap


        //external contracts
        wethAddress: s.wethAddress,
        opAddress: s.opAddress,
        usdcAddress: s.usdcAddress,
        wbtcAddress: s.wbtcAddress,
        aaveAddress: s.aaveAddress,
        uniAddress: s.uniAddress,
        wstethAddress: s.wstethAddress,
        rethAddress: s.rethAddress,

        //oracle contracts
        wETH_CL_FEED: s.wETH_CL_FEED,
        wETH_UNI_POOL: s.wETH_UNI_POOL,

        wstETH_CL_FEED: s.wstETH_CL_FEED,
        wstETH_UNI_POOL: s.wstETH_UNI_POOL,

        rETH_CL_FEED: s.rETH_CL_FEED,
        rETH_UNI_POOL: s.rETH_UNI_POOL,

        OP_CL_FEED: s.OP_CL_FEED,
        OP_UNI_POOL: s.OP_UNI_POOL,

        wBTC_CL_FEED: s.wBTC_CL_FEED,
        wBTC_UNI_POOL: s.wBTC_UNI_POOL,

        UNI_CL_FEED: s.UNI_CL_FEED,
        UNI_UNI_POOL: s.UNI_UNI_POOL,

        AAVE_CL_FEED: s.AAVE_CL_FEED,
        AAVE_UNI_POOL: s.AAVE_UNI_POOL,
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

