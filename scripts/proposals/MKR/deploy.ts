import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    MKRVotingVaultController,
    MKRVotingVaultController__factory,
    CappedMkrToken,
    CappedMkrToken__factory,
    UniswapV3TokenOracleRelay,
    UniswapV3TokenOracleRelay__factory,
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    IOracleRelay
} from "../../../typechain-types"
import { toNumber } from "../../../util/math"
import { d } from "../DeploymentInfo"
import { showBody, showBodyCyan } from "../../../util/format"
import { network } from "hardhat"
import hre from 'hardhat'
import { currentBlock, resetCurrent } from "../../../util/block"

const { ethers } = require("hardhat")

const uniPriceFeed = "0xe8c6c9227491C0a8156A0106A0204d881BB7E531"
const clFeed = "0xec1d1b3b0443256cc3860e24a46f108e699484aa"

let MKRVotingController: MKRVotingVaultController
let CappedMKR: CappedMkrToken

let uniswapOracle: IOracleRelay
let chainlinkOracle: IOracleRelay
let anchorViewRelay: IOracleRelay

const deployController = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    /**
    //MKRVotingController = await new MKRVotingVaultController__factory(deployer).deploy()
    const initController = await MKRVotingController.initialize(d.VaultController)
    await initController.wait()
     */
    const mkrControllerImp = "0xEba2255b1e8Bb9A5fcD456cf115A467e61008D73"

    const cMKRVVC = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        mkrControllerImp,
        proxy.address,
        "0x"
    )
    await cMKRVVC.deployed()

    MKRVotingController = new MKRVotingVaultController__factory(deployer).attach(cMKRVVC.address)
    await MKRVotingController.initialize(d.VaultController)

    console.log("MKRVotingVaultController initialized", MKRVotingController.address)


}

const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const ucMKR = await new CappedMkrToken__factory(deployer).deploy()
    await ucMKR.deployed()
    console.log("ucMKR deployed: ", ucMKR.address)

    const cMKR = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucMKR.address,
        proxy.address,
        "0x"
    )
    await cMKR.deployed()

    CappedMKR = new CappedMkrToken__factory(deployer).attach(cMKR.address)
    console.log("Capped MKR deployed to: ", cMKR.address)
    const initMKR = await CappedMKR.initialize(
        "Capped MKR",
        "cMKR",
        d.mkrAddress,
        d.VaultController,
        "0x491397f7eb6f5d9B82B15cEcaBFf835bA31f217F"
    )
    await initMKR.wait()
    console.log("Capped MKR Initialized", CappedMKR.address)
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
    console.log("MKR anchor view price: ", await toNumber(await anchorViewRelay.currentValue()))
}

const deploy = async (deployer: SignerWithAddress) => {
    //await deployController(deployer)
    //console.log("Deployed new controller")

    await deployCapTokens(deployer)
    console.log("All Cap Tokens deployed")

    //await deployOracles(deployer)
    //console.log("All oracles have been deployed successfully")

    //const MKR_CAP = BN("5400000e18")
    //await CappedMKR.setCap(MKR_CAP)
    //console.log("Set MKR cap to: ", await toNumber(MKR_CAP))
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
