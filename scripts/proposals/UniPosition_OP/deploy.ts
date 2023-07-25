import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory, V3PositionValuator,
    V3PositionValuator__factory,
    Univ3CollateralToken__factory,
    Univ3CollateralToken,
    NftVaultController,
    NftVaultController__factory,
    VaultController__factory
} from "../../../typechain-types"
import { d } from "../../../util/addresser"
import { currentBlock, resetCurrent, resetCurrentOP } from "../../../util/block"
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
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const pvalImplementation = await new V3PositionValuator__factory(deployer).deploy()
    await pvalImplementation.deployed()
    console.log("Position Valuator Implementation deployed: ", pvalImplementation.address)

    const pvalProxy = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        pvalImplementation.address,
        proxy.address,
        "0x"
    )
    await pvalProxy.deployed()

    PositionValuator = new V3PositionValuator__factory(deployer).attach(pvalProxy.address)
    const init = await PositionValuator.initialize(
        nfpManagerAddr,
        FACTORY_V3_ADDR
    )
    await init.wait()
    console.log("Position Valuator initialized: ", PositionValuator.address)

    return PositionValuator.address

}

const deployWrappedPosition = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const wtImplementation = await new Univ3CollateralToken__factory(deployer).deploy()
    await wtImplementation.deployed()
    console.log("Wrapped Position Implementation deployed: ", wtImplementation.address)

    const wtProxy = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        wtImplementation.address,
        proxy.address,
        "0x"
    )
    await wtProxy.deployed()

    WrappedPosition = new Univ3CollateralToken__factory(deployer).attach(wtProxy.address)
    const initTOKEN = await WrappedPosition.initialize(
        "Wrapped Uniswap V3 Position",
        "wPosition",
        nfpManagerAddr,
        d.VaultController,
        d.VotingVaultController,
        PositionValuator.address
    )
    await initTOKEN.wait()
    console.log("Wrapped Position Initialized", WrappedPosition.address)

    return WrappedPosition.address
}

const deployNftVaultController = async (deployer: SignerWithAddress) => {
    NftVC = await DeployNewProxyContract(
        new NftVaultController__factory(deployer),
        deployer,
        d.ProxyAdmin,
        undefined,
        d.VaultController
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

    const oracleAddrs = await deployOracles(deployer)

    console.log("All oracles have been deployed successfully")

    const wrappedPosition = await deployWrappedPosition(deployer)

    const nftController = await deployNftVaultController(deployer)

    const newImp = await deployNewVcImplentation(deployer)

    console.log("DONE")

    return [oracleAddrs, wrappedPosition, nftController, newImp]


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


