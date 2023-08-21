import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    RPLVotingVaultController,
    RPLVotingVaultController__factory,
    CappedGovToken__factory,
    UniswapV3TokenOracleRelay,
    UniswapV3TokenOracleRelay__factory,
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    IOracleRelay,
    CappedGovToken
} from "../../../typechain-types"
import { toNumber } from "../../../util/math"
import { a, c, d } from "../../../util/addresser"
import { showBody, showBodyCyan } from "../../../util/format"
import { network } from "hardhat"
import hre from 'hardhat'
import { currentBlock, resetCurrent } from "../../../util/block"

const { ethers } = require("hardhat")

const uniPriceFeed = "0x632E675672F2657F227da8D9bB3fE9177838e726"
const clFeed = "0x4e155ed98afe9034b7a5962f6c84c86d869daa9d"

let CappedRPL: CappedGovToken

let uniswapOracle: IOracleRelay
let chainlinkOracle: IOracleRelay
let anchorViewRelay: IOracleRelay



const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const ucRPL = await new CappedGovToken__factory(deployer).deploy()
    await ucRPL.deployed()
    console.log("ucRPL deployed: ", ucRPL.address)

    const cRPL = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucRPL.address,
        proxy.address,
        "0x"
    )
    await cRPL.deployed()

    CappedRPL = new CappedGovToken__factory(deployer).attach(cRPL.address)
    console.log("Capped RPL deployed to: ", cRPL.address)
    const initRPL = await CappedRPL.initialize(
        "Capped RPL",
        "cRPL",
        a.rplAddress,
        d.VaultController,
        d.VotingVaultController
    )
    await initRPL.wait()
    console.log("Capped RPL Initialized", CappedRPL.address)
}

const deployOracles = async (deployer: SignerWithAddress) => {
    const UniV3Factory = new UniswapV3TokenOracleRelay__factory(deployer)
    const chainlinkFactory = new ChainlinkOracleRelay__factory(deployer)
    const anchorViewFactory = new AnchoredViewRelay__factory(deployer)

    uniswapOracle = await UniV3Factory.deploy(
        14400,
        uniPriceFeed,
        false,
        BN("1"),
        BN("1")
    )
    await uniswapOracle.deployed()
    console.log("Uniswap oracle address:", uniswapOracle.address)
    console.log("Uni Price: ", await toNumber(await uniswapOracle.currentValue()))

    chainlinkOracle = await chainlinkFactory.deploy(
        clFeed,
        BN("1e10"),
        BN("1")
    )
    await chainlinkOracle.deployed()
    console.log("ChainLink oracle address:", chainlinkOracle.address)
    console.log("CL Price: ", await toNumber(await chainlinkOracle.currentValue()))

    anchorViewRelay = await anchorViewFactory.deploy(
        uniswapOracle.address,
        chainlinkOracle.address,
        BN("10"),
        BN("100")
    )
    await anchorViewRelay.deployed()
    console.log("Anchor View Relay address:", anchorViewRelay.address)
    console.log("RPL anchor view price: ", await toNumber(await anchorViewRelay.currentValue()))
}

const deploy = async (deployer: SignerWithAddress) => {


    await deployCapTokens(deployer)
    console.log("All Cap Tokens deployed")

    await deployOracles(deployer)
    console.log("All oracles have been deployed successfully")

    const RPL_CAP = BN("5400000e18")
    await CappedRPL.setCap(RPL_CAP)
    //console.log("Set RPL cap to: ", await toNumber(RPL_CAP))
}

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
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]

    await deploy(deployer)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
