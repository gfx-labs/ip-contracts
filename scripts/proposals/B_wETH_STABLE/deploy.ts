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
    CappedBptToken__factory,
    CappedBptToken,
    WstETHRelay__factory,
    BPTstablePoolOracle__factory,
    VotingVaultController__factory
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { a, c, d } from "../../../util/addresser"
import { currentBlock, reset, resetCurrent } from "../../../util/block";
import { network } from "hardhat";
import hre from 'hardhat'
import { showBody, showBodyCyan } from "../../../util/format";
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

const wethOracleAddr = "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"
const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
const wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"

const B_stETH_STABLE = "0x32296969Ef14EB0c6d29669C550D4a0449130230"
const rewardsAddress = "0x59D66C58E83A26d6a0E35114323f65c3945c89c1"
const booster = "0xA57b8d98dAE62B26Ec3bcC4a365338157060B234"
const PID = "115"
const CAP = BN("60e18")



let CappedWSTETH_STABLE: CappedBptToken

const deployCapTOKENs = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    //deploy a new capped TOKEN implementation if needed, otherwise use an existing implementation
    const existingImplementation = await new CappedBptToken__factory(deployer).deploy()
    console.log("Capped BPT implementation deployed to: ", existingImplementation.address)

    const cTOKEN = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        existingImplementation.address,
        proxy.address,
        "0x"
    )
    await cTOKEN.deployed()

    CappedWSTETH_STABLE = new CappedBptToken__factory(deployer).attach(cTOKEN.address)
    console.log("Capped BPT deployed to: ", cTOKEN.address)
    const initTOKEN = await CappedWSTETH_STABLE.initialize(
        "Capped B_stETH_STABLE",
        "cB_stETH_STABLE",
        B_stETH_STABLE,
        d.VaultController,
        d.VotingVaultController
    )
    await initTOKEN.wait()
    console.log("Capped BPT Initialized", CappedWSTETH_STABLE.address)
}

const deployOracles = async (deployer: SignerWithAddress) => {
    const wstethRelay = await new WstETHRelay__factory(deployer).deploy()
    await wstethRelay.deployed()
    //showBody("wstEth result: ", await toNumber(await wstethRelay.currentValue()))
    const stEThMetaStablePoolOracle = await new BPTstablePoolOracle__factory(deployer).deploy(
        B_stETH_STABLE, //pool_address
        balancerVault,
        [wstETH, a.wethAddress], //_tokens
        [wstethRelay.address, wethOracleAddr], //_oracles
        BN("200"),//200 BIP / 2% buffer
        BN("10000")
    )
    await stEThMetaStablePoolOracle.deployed()
    showBodyCyan("BPT PRICE : ", await toNumber(await stEThMetaStablePoolOracle.currentValue()))
    console.log("Stable Pool Oracle Deployed: ", stEThMetaStablePoolOracle.address)

}

const deployVVC = async (deployer: SignerWithAddress) => {
    const implementation = await new VotingVaultController__factory(deployer).deploy()
    await implementation.deployed()
    console.log("Voting Vault Controller Implementation deployed to: ", implementation.address)

}

const deploy = async (deployer: SignerWithAddress) => {
 
    console.log(BN("200"), BN("10000"))

    await deployCapTOKENs(deployer)
    console.log("All Cap BPTs deployed")

    await deployVVC(deployer)
    console.log("VVC implementation deployed")

    await deployOracles(deployer)
    console.log("All oracles have been deployed successfully")

    await CappedWSTETH_STABLE.setCap(CAP)
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
/**
 * Verify
hh verify --network mainnet --constructor-args ./scripts/args.js 0xD6B002316D4e13d2b7eAff3fa5Fc6c20D2CeF4be
hh verify --network mainnet 0xD6B002316D4e13d2b7eAff3fa5Fc6c20D2CeF4be "0x32296969Ef14EB0c6d29669C550D4a0449130230" "0xBA12222222228d8Ba445958a75a0704d566BF2C8" "["0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]" "["0x47CBd328B185Ea8fC61Ead9a32d0edd79067b577","0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"]" "200" "10000"


*/



/**
DEPLOYING TO MAINNET
Block:  17494795
Deployer:  0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89
Capped BPT implementation deployed to:  0x0CDb61ab468a2f89D1636c95b32D88c0eA6ef826
Capped BPT deployed to:  0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d
Capped BPT Initialized 0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d
All Cap BPTs deployed
Voting Vault Controller Implementation deployed to:  0x17B7bD832666Ac28A6Ad35a93d4efF4eB9A07a17
VVC implementation deployed
    ↓   BPT PRICE :  1,780.1628459677377
Stable Pool Oracle Deployed:  0xD6B002316D4e13d2b7eAff3fa5Fc6c20D2CeF4be
All oracles have been deployed successfully
 */