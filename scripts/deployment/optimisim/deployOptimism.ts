import { network } from "hardhat";
import hre from 'hardhat';
import { currentBlock, resetCurrentOP } from "../../../util/block";
import { s } from "./scope";
import { Deployment, DeploymentInfo } from "./optimisimDeployment";
import { BN } from "../../../util/number";
import { showBody, showBodyCyan } from "../../../util/format";
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
        WethLiqInc: BN("5e16"),
        WethCap: BN("2700e18"), //$5mm

        wBtcLTV: BN("8e17"),
        wBtcLiqInc: BN("7e16"),
        wBtcCap: BN("190e8"), //$5mm

        OpLTV: BN("7e17"),
        OpLiqInc: BN("7e16"),
        OpCap: BN("1500000e18"), //$2mm

        wstEthLTV: BN("8e17"),
        wstEthLiqInc: BN("7e16"),
        wstEthCap: BN("1000e18"),//$2mm 

        rEthLTV: BN("75e16"),
        rEthLiqInc: BN("7e16"),
        rEthCap: BN("500e18"),//$1mm 


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
            showBodyCyan("CONTRACTS ALL DEPLOYED")
        })
        .catch((e) => {
            console.log(e)
        })

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

