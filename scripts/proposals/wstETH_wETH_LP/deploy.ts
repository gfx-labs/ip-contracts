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
    VotingVaultController__factory,
    CappedBptToken__factory,
    CappedBptToken,
    WstETHRelay__factory,
    BPTstablePoolOracle__factory
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo";
import { currentBlock, reset, resetCurrent } from "../../../util/block";
import { network } from "hardhat";
import hre from 'hardhat'
const { ethers } = require("hardhat");

const B_stETH_STABLE = "0x32296969Ef14EB0c6d29669C550D4a0449130230"
const wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
const wethOracleAddr = "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"//production weth oracle for IP

let vvcImplementationAddr: String
let stEThMetaStablePoolOracle: IOracleRelay
let wstethRelay: IOracleRelay


/*****************************CHANGE THESE/*****************************/
const ASSET_ADDRESS = B_stETH_STABLE
//const CHAINLINK_DATA_FEED = "0x2c1d072e956affc0d435cb7ac38ef18d24d9127c"
//const UNIV3_POOL = "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8"
const CAP = BN("50e18")//low cap to start, ~$100K USD
/***********************************************************************/

let CappedBPT: CappedBptToken

const deployImplementation = async (deployer: SignerWithAddress) => {
    const implementation = await new VotingVaultController__factory(deployer).deploy()
    await implementation.deployed()
    vvcImplementationAddr = implementation.address
}

const deployCapTOKENs = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const ucWSTETH = await new CappedBptToken__factory(deployer).deploy()

    const cWSTETH = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucWSTETH.address,
        proxy.address,
        "0x"
    )
    await cWSTETH.deployed()

    CappedBPT = new CappedBptToken__factory(deployer).attach(cWSTETH.address)
    console.log("Capped TOKEN deployed to: ", cWSTETH.address)
    const initTOKEN = await CappedBPT.initialize(
        "Capped WSTETH/WETH StablePool",
        "cWSTETH/WETH_BPT",
        ASSET_ADDRESS,
        d.VaultController,
        d.VotingVaultController
    )
    await initTOKEN.wait()
    console.log("Capped TOKEN Initialized", CappedBPT.address)

}

const deployOracles = async (deployer: SignerWithAddress) => {

    //deploy wsteth relay
    wstethRelay = await new WstETHRelay__factory(deployer).deploy()
    await wstethRelay.deployed()
    console.log("wstETH direct conversion relay deployed to: ", wstethRelay.address)
    console.log("wstETH direct conversion price: ", await toNumber(await wstethRelay.currentValue()))

    //deploy stable pool oracle
    stEThMetaStablePoolOracle = await new BPTstablePoolOracle__factory(deployer).deploy(
        B_stETH_STABLE, //pool_address
        balancerVault,
        [wstETH, d.wethAddress], //_tokens
        [wstethRelay.address, wethOracleAddr], //_oracles
        BN("5"), //0.5% buffer range for outGivenIn
        BN("1000")
      )
      await stEThMetaStablePoolOracle.deployed()
      console.log("MetaStablePool BPT oracle deployed to: ", stEThMetaStablePoolOracle.address)
      console.log("B_stETH_STABLE MetaStablePool BPT price: ", await toNumber(await (await stEThMetaStablePoolOracle.currentValue())))

}

const deploy = async (deployer: SignerWithAddress) => {

    await deployImplementation(deployer)
    console.log("Voting Vault Controller new Implementation deployed to: ", vvcImplementationAddr)

    await deployCapTOKENs(deployer)
    console.log("All Cap TOKENs deployed")

    await deployOracles(deployer)
    console.log("All oracles have been deployed successfully")

    await CappedBPT.setCap(CAP)
    console.log("Set TOKEN cap to: ", await toNumber(CAP))

};

async function main() {
    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST DEPLOYMENT: ", networkName)
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
