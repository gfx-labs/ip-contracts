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
const CURVE_POOL = "0x94B17476A93b3262d87B9a326965D1E91f9c13E7"
const CAP = BN("575e18")
/***********************************************************************/

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
        ASSET_ADDRESS,
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
        CURVE_POOL,
        ASSET_ADDRESS,
        d.EthOracle
    )
    await AnchorView.deployed()

    console.log("Anchor View Price: ", await toNumber(await AnchorView.currentValue()))
}

const deploy = async (deployer: SignerWithAddress) => {


    await deployCapTOKENs(deployer)

    console.log("All contracts deployed")

    await deployOracles(deployer)

    console.log("All oracles have been deployed")

    await CappedWOETH.setCap(CAP)
    console.log("Set cap to: ", await toNumber(CAP))

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

    console.log("Getting accounts")
    const accounts = await ethers.getSigners();
    console.log("Got accounts")
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
