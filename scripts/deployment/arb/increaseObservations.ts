import { network } from "hardhat";
import hre from 'hardhat';
import { currentBlock, hardhat_mine, hardhat_mine_timed, resetCurrentOP } from "../../../util/block";
import { Deployment, DeploymentInfo } from "./Deployment";
import { BN } from "../../../util/number";
import { showBody, showBodyCyan } from "../../../util/format";
import { getGas, toNumber } from "../../../util/math"
import { SignKeyObjectInput } from "crypto";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { OptimisimAddresses, OptimisimDeploys } from "../../../util/addresser";
import { CrossChainAccount__factory, IUniV3Pool__factory, OracleMaster__factory, VaultController__factory } from "../../../typechain-types";
const { ethers } = require("hardhat");
const deployerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
const observations = 1440
let deployer: SignerWithAddress
async function main() {
    console.log("START")
    const deploys = new OptimisimDeploys()
    const addresses = new OptimisimAddresses()

    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST DEPLOYMENT: ", networkName)
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        const block = await currentBlock()
        console.log("Deploying on OPTIMISM as of block: ", block.number)
        await impersonateAccount(deployerAddr)
        deployer = ethers.provider.getSigner(deployerAddr)
        console.log("Deployer: ", deployerAddr)
    } else {
        console.log("DEPLOYING TO: ", networkName)
        let accounts = await ethers.getSigners();
        deployer = accounts[0]
        console.log("Deployer: ", deployer.address)
    }

    let wethPool = IUniV3Pool__factory.connect(addresses.wETH_UNI_POOL, deployer)
    let [,
        ,
        ,
        wethObservations,
        ,
        ,
    ] = await wethPool.slot0()
    console.log("wEth current observations: ", wethObservations)
    if (wethObservations < observations) {
        console.log("Setting higher observations...")
        let result = await wethPool.increaseObservationCardinalityNext(observations)
        let gas = await getGas(result)
        console.log(`Set weth pool observations to ${observations}, gas: `, gas)//23,156,436
    }

    let rethPool = IUniV3Pool__factory.connect(addresses.rETH_UNI_POOL, deployer)
    let [,
        ,
        ,
        rethObservations,
        ,
        ,
    ] = await rethPool.slot0()
    console.log("rETH current observations: ", rethObservations)
    if (rethObservations < observations) {
        console.log("Setting higher observations...")
        const result = await rethPool.increaseObservationCardinalityNext(observations)
        const gas = await getGas(result)
        console.log(`Set rETH pool observations to ${observations}, gas: `, gas)
    }

    let wstethPool = IUniV3Pool__factory.connect(addresses.wstETH_UNI_POOL, deployer)
    let [,
        ,
        ,
        wstethObservations,
        ,
        ,
    ] = await wstethPool.slot0()
    console.log("wsteth current observations: ", wstethObservations)
    if (wstethObservations < observations) {
        console.log("Setting higher observations...")
        const result = await wstethPool.increaseObservationCardinalityNext(observations)
        const gas = await getGas(result)
        console.log(`Set wsteth pool observations to ${observations}, gas: `, gas)
    }

    let opPool = IUniV3Pool__factory.connect(addresses.OP_UNI_POOL, deployer)
    let [,
        ,
        ,
        opObservations,
        ,
        ,
    ] = await opPool.slot0()
    console.log("OP current observations: ", opObservations)
    if (opObservations < observations) {
        console.log("Setting higher observations...")
        const result = await opPool.increaseObservationCardinalityNext(observations)
        const gas = await getGas(result)
        console.log(`Set OP pool observations to ${observations}, gas: `, gas)
    }

    let wbtcPool = IUniV3Pool__factory.connect(addresses.wBTC_UNI_POOL, deployer)
    let [,
        ,
        ,
        wbtcObservations,
        ,
        ,
    ] = await wbtcPool.slot0()
    console.log("wbtc current observations: ", wbtcObservations)
    if (wbtcObservations < observations) {
        console.log("Setting higher observations...")
        const result = await wbtcPool.increaseObservationCardinalityNext(observations)
        const gas = await getGas(result)
        console.log(`Set wbtc pool observations to ${observations}, gas: `, gas)
    }

    //await hardhat_mine_timed(10000, 2)

    const oracle = OracleMaster__factory.connect(deploys.Oracle, deployer)
    showBody("Testing oracles")
    showBody("wEth Oracle Price: ", await toNumber(await oracle.getLivePrice(deploys.CappedWeth)))
    showBody("rEth Oracle Price: ", await toNumber(await oracle.getLivePrice(deploys.CappedRETH)))
    showBody("wstEth Oracle Price: ", await toNumber(await oracle.getLivePrice(deploys.CappedWstEth)))
    showBody("OP Oracle Price: ", await toNumber(await oracle.getLivePrice(deploys.CappedOp)))
    showBody("wBtc Oracle Price: ", await toNumber(await oracle.getLivePrice(deploys.CappedWbtc)))

    //await VC.connect(deployer).transferOwnership(messenger.address)



}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
