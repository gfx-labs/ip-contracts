import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken, CappedGovToken__factory,
    AnchoredViewRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    IOracleRelay,
    ChainlinkOracleRelay__factory,
    UniswapV3TokenOracleRelay__factory,
    CappedERC4626__factory,
    WOETH_ORACLE__factory
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { a, c, d } from "../../../util/addresser"
import { currentBlock, reset, resetCurrent } from "../../../util/block";
import { network } from "hardhat";
import hre from 'hardhat'
import { DeployContract, DeployNewProxyContract } from "../../../util/deploy";
const { ethers } = require("hardhat");

/*****************************CHANGE THESE/*****************************/
const ASSET_ADDRESS = a.woethAddress
//const CHAINLINK_DATA_FEED = "0x2c1d072e956affc0d435cb7ac38ef18d24d9127c"
//const UNIV3_POOL = "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8"
const CAP = BN("375000e18")
/***********************************************************************/


//const existingImplementation = "0x9F86bf2C380d3C63177e6104320Fd3D1DcAE88DA"

let CappedWOETH: CappedGovToken
let AnchorView: IOracleRelay

const deployCapTOKENs = async (deployer: SignerWithAddress) => {
    CappedWOETH = await DeployNewProxyContract(
        new CappedERC4626__factory(deployer),
        deployer,
        d.ProxyAdmin,
        undefined,
        "CappedWOETH",
        "cwOETH",
        a.woethAddress,
        a.oethAddress,
        d.VaultController,
        d.VotingVaultController
    )
    await CappedWOETH.deployed()
}

const deployOracles = async (deployer: SignerWithAddress) => {

    AnchorView = await DeployContract(
        new WOETH_ORACLE__factory(deployer),
        deployer,
        "0x94B17476A93b3262d87B9a326965D1E91f9c13E7",//curve pool
        a.woethAddress,
        d.EthOracle
    )
    await AnchorView.deployed()

    console.log("Anchor View Price: ", await toNumber(await AnchorView.currentValue()))
}

const deploy = async (deployer: SignerWithAddress) => {


    await deployCapTOKENs(deployer)

    console.log("All Cap TOKENs deployed")

    await deployOracles(deployer)

    console.log("All oracles have been deployed successfully")

    //await CappedWOETH.setCap(CAP)
    //console.log("Set TOKEN cap to: ", await toNumber(CAP))

};

async function main() {
    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
        console.log("TEST DEPLOYMENT AT BLOCK: ", await (await currentBlock()).number)
    } else {
        console.log("DEPLOYING TO MAINNET")
    }


    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    console.log("Deployer: ", deployer.address)

    await deploy(deployer)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
