import { network } from "hardhat";
import hre from 'hardhat';
import { currentBlock, resetCurrentOP } from "../../../util/block";
import { Deployment, DeploymentInfo } from "./Deployment";
import { BN } from "../../../util/number";
import { showBody, showBodyCyan } from "../../../util/format";
import { toNumber } from "../../../util/math"
import { SignKeyObjectInput } from "crypto";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { OptimisimAddresses, OptimisimDeploys } from "../../../util/addresser";
import { OracleMaster__factory, VaultController__factory } from "../../../typechain-types";

const { ethers } = require("hardhat");
const deployerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
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
        wethAddress: addresses.wethAddress,
        opAddress: addresses.opAddress,
        usdcAddress: addresses.usdcAddress,
        wbtcAddress: addresses.wbtcAddress,
        aaveAddress: addresses.aaveAddress,
        uniAddress: addresses.uniAddress,
        wstethAddress: addresses.wstethAddress,
        rethAddress: addresses.rethAddress,

        //oracle contracts
        wETH_CL_FEED: addresses.wETH_CL_FEED,
        wETH_UNI_POOL: addresses.wETH_UNI_POOL,

        wstETH_CL_FEED: addresses.wstETH_CL_FEED,
        wstETH_UNI_POOL: addresses.wstETH_UNI_POOL,

        rETH_CL_FEED: addresses.rETH_CL_FEED,
        rETH_UNI_POOL: addresses.rETH_UNI_POOL,

        OP_CL_FEED: addresses.OP_CL_FEED,
        OP_UNI_POOL: addresses.OP_UNI_POOL,

        wBTC_CL_FEED: addresses.wBTC_CL_FEED,
        wBTC_UNI_POOL: addresses.wBTC_UNI_POOL,

        UNI_CL_FEED: addresses.UNI_CL_FEED,
        UNI_UNI_POOL: addresses.UNI_UNI_POOL,

        AAVE_CL_FEED: addresses.AAVE_CL_FEED,
        AAVE_UNI_POOL: addresses.AAVE_UNI_POOL,

        //deployed contracts

        VaultController: deploys.VaultController,
        Oracle: deploys.Oracle,
        USDI: deploys.USDI,
        ProxyAdmin: deploys.ProxyAdmin,
        VotingVaultController: deploys.VotingVaultController,
        Curve: deploys.Curve,
        ThreeLines: deploys.ThreeLines,
        CappedImplementation: deploys.CappedImplementation,
        CappedWeth: deploys.CappedWeth,
        //EthOracle: deploys.EthOracle,
        CappedWbtc: deploys.CappedWbtc,
        //wBtcOracle: deploys.wBtcOracle,
        CappedOp: deploys.CappedOp,
        //OpOracle: deploys.OpOracle,
        CappedWstEth: deploys.CappedWstEth,
        //wstEthOracle: deploys.wstEthOracle,
        CappedRETH: deploys.CappedRETH,
        //rEthOracle: deploys.rEthOracle,

    }

    const d = new Deployment(deployer, info)
    await d
        .ensure()
        .then(() => {
            showBodyCyan("CONTRACTS ALL ENSURED")
        })
        .catch((e) => {
            console.log(e)
        })

   

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
