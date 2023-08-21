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
import { a, c, d } from "../../../util/addresser"
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


const deploy = async (deployer: SignerWithAddress) => {
   const imp = await new MKRVotingVaultController__factory(deployer).deploy()
   await imp.deployed()
   console.log("New implementation deployed: ", imp.address)
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
