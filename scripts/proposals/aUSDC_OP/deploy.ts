import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    V3PositionValuator,
    V3PositionValuator__factory,
    Univ3CollateralToken__factory,
    Univ3CollateralToken,
    NftVaultController,
    NftVaultController__factory,
    VaultController__factory,
    UsdcRelay__factory
} from "../../../typechain-types"
import { od } from "../../../util/addresser"
import { currentBlock, resetCurrentOP } from "../../../util/block"
import { DeployNewProxyContract } from "../../../util/deploy"
import { network } from "hardhat"
import hre from 'hardhat'
const { ethers } = require("hardhat")

const nfpManagerAddr = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
const FACTORY_V3_ADDR = "0x1F98431c8aD98523631AE4a59f267346ea31F984"

let WrappedPosition: Univ3CollateralToken
let PositionValuator: V3PositionValuator
let NftVC: NftVaultController

const deployOracles = async (deployer: SignerWithAddress) => {
    PositionValuator = await DeployNewProxyContract(
        new V3PositionValuator__factory(deployer),
        deployer,
        od.ProxyAdmin,
        od.PositionValuatorImplementation,
        nfpManagerAddr,
        FACTORY_V3_ADDR
    )
    console.log("Deployed PositionValuator: ", PositionValuator.address)
    return PositionValuator.address
}

const deployWrappedPosition = async (deployer: SignerWithAddress) => {
    WrappedPosition = await DeployNewProxyContract(
        new Univ3CollateralToken__factory(deployer),
        deployer,
        od.ProxyAdmin,
        od.WrappedPositionImplementation,
        "Wrapped Uniswap V3 Position",
        "wPosition",
        nfpManagerAddr,
        od.VaultController,
        od.NftController,
        PositionValuator.address
    )
    console.log("Deployed WrappedPosition: ", WrappedPosition.address)
    return WrappedPosition.address
}

const deployNftVaultController = async (deployer: SignerWithAddress) => {
    NftVC = await DeployNewProxyContract(
        new NftVaultController__factory(deployer),
        deployer,
        od.ProxyAdmin,
        od.NftControllerImplementation,
        od.VaultController
    )
    console.log("Deployed Nft Controller: ", NftVC.address)
    return NftVC.address
}

const deployNewVcImplentation = async (deployer: SignerWithAddress) => {
    const implementation = await new VaultController__factory(deployer).deploy()
    await implementation.deployed()
    console.log("New Vault Controller Implementation Deployed: ", implementation.address)
    return implementation.address
}


const deploy = async (deployer: SignerWithAddress) => {
    console.log("Deploying")

    //deploy usdc relay
    const usdcRelay = await new UsdcRelay__factory(deployer).deploy()
    console.log("UDSC relay deployed: ", usdcRelay.address)

    //const oracleAddrs = await deployOracles(deployer)

    //PositionValuator = V3PositionValuator__factory.connect(od.V3PositionValuator, deployer)
    //const wrappedPosition = await deployWrappedPosition(deployer)

    //const nftController = await deployNftVaultController(deployer)

    //const newImp = await deployNewVcImplentation(deployer)

    //console.log("DONE")

    //return [oracleAddrs, wrappedPosition, nftController, od.VC_Implementation]

}

export const run = async (deployer: SignerWithAddress) => {
    return await deploy(deployer)

}

async function main() {
    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        console.log("TEST DEPLOYMENT AT BLOCK: ", await (await currentBlock()).number)
    } else {
        console.log("DEPLOYING TO ", networkName)
    }


    const accounts = await ethers.getSigners()
    const deployer = accounts[0]
    console.log("Deployer: ", deployer.address)

    await deploy(deployer)

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })


/**
Wrapped Position Implementation deployed:  0x833A17FA29bc2772e4302823B7d39eDd7C4bB79a
Wrapped Position Initialized 0xe7101ec20E1bdfd1509369C026eaD532B17C04c1
New Implementation Deployed:  0x68338eC08c8bA70230F8621effCb89b2BA45e80F
Deployed Nft Controller:  0xec993a3C466F6876a79C0AE9E7954E3e0181097a
New Vault Controller Implementation Deployed:  0x95c157Fe454AC1aDFA17dC9C3745bdBa992F9Caf
 */