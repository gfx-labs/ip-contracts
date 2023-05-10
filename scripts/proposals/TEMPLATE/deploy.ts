import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken, CappedGovToken__factory,
    AnchoredViewRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    IOracleRelay,
    ChainlinkOracleRelay__factory,
    UniswapV3TokenOracleRelay__factory
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo";
import { currentBlock, reset, resetCurrent } from "../../../util/block";
import { network } from "hardhat";
import hre from 'hardhat'
const { ethers } = require("hardhat");

/**
 * This script is for deploying the cap token and oracles for a new asset listing on Interest Protocol
 * This is for 'standard' asset listings, such that:
 * -There is a decent Chainlink Data Feed - see https://data.chain.link/
 * -There is a decent Uniswap V3 pool against wETH or USDC
 * -Existing cap token functionality is sufficient 
 * 
 * THIS SCRIPT DOES NOT TRANSFER OWNERSHIP
 * After deployment, once all contracts are VERRIFIED and everything looks good,
 * Ownership should be transferred to Interest Protocol Governance: 0x266d1020A84B9E8B0ed320831838152075F8C4cA
 */


/*****************************CHANGE THESE/*****************************/
const ASSET_ADDRESS = "0x514910771AF9Ca656af840dff83E8264EcF986CA"
const CHAINLINK_DATA_FEED = "0x2c1d072e956affc0d435cb7ac38ef18d24d9127c"
const UNIV3_POOL = "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8"
const CAP = BN("375000e18")
/***********************************************************************/


const existingImplementation = "0x9F86bf2C380d3C63177e6104320Fd3D1DcAE88DA"

let CappedTOKEN: CappedGovToken
let AnchorView: IOracleRelay

const deployCapTOKENs = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    //deploy a new capped TOKEN implementation if needed, otherwise use an existing implementation
    //const ucTOKEN = await new CappedGovToken__factory(deployer).deploy()

    const cTOKEN = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        existingImplementation,
        proxy.address,
        "0x"
    )
    await cTOKEN.deployed()

    CappedTOKEN = new CappedGovToken__factory(deployer).attach(cTOKEN.address)
    console.log("Capped TOKEN deployed to: ", cTOKEN.address)
    const initTOKEN = await CappedTOKEN.initialize(
        "Capped TOKEN",
        "cTOKEN",
        ASSET_ADDRESS,
        d.VaultController,
        d.VotingVaultController
    )
    await initTOKEN.wait()
    console.log("Capped TOKEN Initialized", CappedTOKEN.address)

}

const deployOracles = async (deployer: SignerWithAddress) => {

    //TOKEN ORACLES
    const clRelayTOKEN = await new ChainlinkOracleRelay__factory(deployer).deploy(
        CHAINLINK_DATA_FEED,
        BN("1e10"),
        BN("1")
    )
    await clRelayTOKEN.deployed()
    //console.log("ChainTOKEN TOKEN data feed price: ", await toNumber(await clRelayTOKEN.currentValue()))

    //uni v3 oracle 
    const uniRelayTOKEN = await new UniswapV3TokenOracleRelay__factory(deployer).deploy(
        14400,
        UNIV3_POOL,
        false,
        BN("1"),
        BN("1")
    )
    await uniRelayTOKEN.deployed()
    //console.log("uni v3 TOKEN relay price: ", await toNumber(await uniRelay.currentValue()))


    AnchorView = await new AnchoredViewRelay__factory(deployer).deploy(
        uniRelayTOKEN.address,
        clRelayTOKEN.address,
        BN("10"),
        BN("100")
    )
    await AnchorView.deployed()
    console.log("TOKEN anchor view deployed: ", AnchorView.address)
    console.log("ANCHOR VIEW TOKEN PRICE: ", await toNumber(await AnchorView.currentValue()))

}

const deploy = async (deployer: SignerWithAddress) => {


    await deployCapTOKENs(deployer)

    console.log("All Cap TOKENs deployed")

    await deployOracles(deployer)

    console.log("All oracles have been deployed successfully")

    await CappedTOKEN.setCap(CAP)
    console.log("Set TOKEN cap to: ", await toNumber(CAP))

};

async function main() {
    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST DEPLOYMENT")
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
    } else {
        console.log("DEPLOYING TO MAINNET")
    }


    const block = await currentBlock()
    console.log("Block: ", block.number)

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
