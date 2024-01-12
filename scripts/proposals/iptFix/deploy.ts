import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    UniswapV3TokenOracleRelay__factory, AnchoredViewRelay__factory, ChainlinkOracleRelay__factory, IOracleRelay,
    CappedGovToken,
    CappedGovToken__factory,
    InterestProtocolTokenDelegate__factory
} from "../../../typechain-types"
import { toNumber } from "../../../util/math"
import { DeployNewProxyContract } from "../../../util/deploy"
import { a, c, d } from "../../../util/addresser"
import { network } from "hardhat"
import hre from 'hardhat'
import { currentBlock, resetCurrent } from "../../../util/block"

const { ethers } = require("hardhat")


const deployImplementation = async (deployer: SignerWithAddress) => {
    const newImp = await new InterestProtocolTokenDelegate__factory(deployer).deploy()
    console.log("Deploy: ", newImp.address)
}

const deploy = async (deployer: SignerWithAddress) => {


    await deployImplementation(deployer)
    console.log("All imps have been deployed successfully")


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
Deploy:  0x387EedD357836A73eCEf07067E6360A95C254b17
*/