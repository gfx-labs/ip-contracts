import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken, CappedGovToken__factory,
    AnchoredViewRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory, ChainlinkOracleRelay__factory, UniswapV3OPTokenOracleRelay__factory
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { currentBlock, resetCurrentOP } from "../../../util/block";
import { network } from "hardhat";
import hre from 'hardhat';
import { showBodyCyan } from "../../../util/format";
import { OptimisimAddresses, OptimisimDeploys } from "../../../util/addresser";
const a = new OptimisimAddresses()
const d = new OptimisimDeploys()
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

const snx = "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4"

const SnxLTV = BN("70e16")
const SnxLiqInc = BN("75e15")
const SnxCap = BN("238000e18") 




let CappedSNX: CappedGovToken

const deployCapTOKENs = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const cSNX = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        d.CappedImplementation,
        proxy.address,
        "0x"
    )
    await cSNX.deployed()

    CappedSNX = new CappedGovToken__factory(deployer).attach(cSNX.address)
    console.log("Capped SNX deployed to: ", cSNX.address)
    const initTOKEN = await CappedSNX.initialize(
        "Capped SNX",
        "cSNX",
        snx,
        d.VaultController,
        d.VotingVaultController
    )
    await initTOKEN.wait()
    console.log("Capped SNX Initialized", CappedSNX.address)
}

const deployOracles = async (deployer: SignerWithAddress) => {
    const clFeed = await new ChainlinkOracleRelay__factory(deployer).deploy(
        a.SNX_CL_FEED,
        BN("1e10"),
        BN("1")
    )
    await clFeed.deployed()
    //showBodyCyan("cl price: ", await toNumber(await clFeed.currentValue()))

    const uniFeed = await new UniswapV3OPTokenOracleRelay__factory(deployer).deploy(
        500,
        d.EthOracle,
        a.SNX_UNI_POOL,
        true,
        BN("1"),
        BN("1")
    )
    await uniFeed.deployed()
    //showBodyCyan("uni price: ", await toNumber(await uniFeed.currentValue()))

    const snxOracle = await new AnchoredViewRelay__factory(deployer).deploy(
        uniFeed.address,
        clFeed.address,
        BN("10"),
        BN('100')
    )
    await snxOracle.deployed()
    console.log("snx oracle deployed: ", snxOracle.address)
    showBodyCyan("SNX oracle price: ", await toNumber(await snxOracle.currentValue()))
}


const deploy = async (deployer: SignerWithAddress) => {

    await deployCapTOKENs(deployer)
    console.log("All Cap tokens deployed")

    await deployOracles(deployer)
    console.log("All oracles have been deployed successfully")

    await CappedSNX.setCap(SnxCap)
    console.log("Set Capped SNX cap to: ", await toNumber(SnxCap))

};

async function main() {
    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST DEPLOYMENT")
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        const block = await currentBlock()
        console.log("OPTIMISM @ block: ", block.number)
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
/**
DEPLOYING TO MAINNET
Block:  106108003
Deployer:  0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89
Capped SNX deployed to:  0x45b265c7919D7FD8a0D673D7ACaA8F5A7abb430D
Capped SNX Initialized 0x45b265c7919D7FD8a0D673D7ACaA8F5A7abb430D
All Cap tokens deployed
snx oracle deployed:  0xd8284305b520FF5486ab718DBdfe46f18454aeDE
    ↓   SNX oracle price:  2.0915387
All oracles have been deployed successfully
Set Capped SNX cap to:  238000
 */