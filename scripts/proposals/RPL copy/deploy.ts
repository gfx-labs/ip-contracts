import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    UniswapV3TokenOracleRelay__factory, AnchoredViewRelay__factory, ChainlinkOracleRelay__factory, IOracleRelay,
    CappedGovToken,
    CappedGovToken__factory
} from "../../../typechain-types"
import { toNumber } from "../../../util/math"
import { DeployNewProxyContract } from "../../../util/deploy"
import { a, c, d } from "../../../util/addresser"
import { network } from "hardhat"
import hre from 'hardhat'
import { currentBlock, resetCurrent } from "../../../util/block"

const { ethers } = require("hardhat")

const uniPriceFeed = "0x632E675672F2657F227da8D9bB3fE9177838e726"
const clFeed = "0x4e155ed98afe9034b7a5962f6c84c86d869daa9d"

let CappedRPL: CappedGovToken
const rplCap = BN("21000e18")

let uniswapOracle: IOracleRelay
let chainlinkOracle: IOracleRelay
let anchorViewRelay: IOracleRelay


const deployCapTokens = async (deployer: SignerWithAddress) => {
    CappedRPL = await DeployNewProxyContract(
        new CappedGovToken__factory(deployer),
        deployer,
        d.ProxyAdmin,
        c.CappedGovTokenImplementation,
        "Capped RPL",
        "cRPL",
        a.rplAddress,
        d.VaultController,
        d.VotingVaultController
    )
    await CappedRPL.deployed()
    console.log("Capped RPL deployed: ", CappedRPL.address)
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
   /**
    chainlinkOracle = await chainlinkFactory.deploy(
        clFeed,
        BN("1e10"),
        BN("1")
    )
    await chainlinkOracle.deployed()
    console.log("ChainLink oracle address:", chainlinkOracle.address)
    console.log("CL Price: ", await toNumber(await chainlinkOracle.currentValue()))
     */

    const clOracle = "0x1474303c04f72D47E0896a7FF8a585b14875C63d"

    anchorViewRelay = await anchorViewFactory.deploy(
        uniswapOracle.address,
        clOracle,
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

    await CappedRPL.setCap(rplCap)    
    console.log("Set RPL cap to: ", await toNumber(rplCap))
}

async function main() {
    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
        console.log("TEST DEPLOYMENT AT BLOCK: ", await (await currentBlock()).number)
    } else {
        console.log("DEPLOYING TO: ", networkName)
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


/**
DEPLOYING TO MAINNET
Capped RPL deployed:  0x6b68C5708DAffD0393aCC6A8cc92f8C2146346Ae
All Cap Tokens deployed
Uniswap oracle address: 0xA490CE00E4032A12BEFa2D3B35DeE7333BECfE54
Uni Price:  24.636389117663093
ChainLink oracle address: 0x1474303c04f72D47E0896a7FF8a585b14875C63d
CL Price:  24.48525767
Anchor View Relay address: 0xd3CEd54E5f5D950B1B8711A178e4Eab2de5DB3EC
RPL anchor view price:  24.01491007
All oracles have been deployed successfully
Set RPL cap to:  21000
*/