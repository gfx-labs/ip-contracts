import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    CappedRebaseToken, CappedRebaseToken__factory, IOracleRelay, TransparentUpgradeableProxy__factory, UsdcStandardRelay__factory
} from "../../../typechain-types"
import { oa, od } from "../../../util/addresser"
import { currentBlock, resetCurrentOP } from "../../../util/block"
import { DeployContract, DeployNewProxyContract } from "../../../util/deploy"
import { network } from "hardhat"
import hre from 'hardhat'
const { ethers } = require("hardhat")

let CappedRebase: CappedRebaseToken
let usdcStandardRelay: IOracleRelay

const deployOracles = async (deployer: SignerWithAddress, mainnet: boolean) => {
    usdcStandardRelay = await DeployContract(
        new UsdcStandardRelay__factory(deployer),
        deployer
    )
    await usdcStandardRelay.deployed()
    console.log("Deployed usdcStandardRelay: ", usdcStandardRelay.address)

    if(mainnet){
        //await usdcStandardRelay.deployTransaction.wait(10)
        console.log("Verifying...")
        await hre.run("verify:verify", {
            address: usdcStandardRelay.address
        })
        console.log("verified")
    }

    return usdcStandardRelay.address
}

const deployCappedRebase = async (deployer: SignerWithAddress, mainnet:boolean) => {

    CappedRebase = await DeployNewProxyContract(
        new CappedRebaseToken__factory(deployer),
        deployer,
        od.ProxyAdmin,
        undefined,
        "Capped Opt aUSDC",
        "caOptUSDC",
        oa.aOptUsdcAddress,
        od.VaultController
    )
    await CappedRebase.deployed()
    console.log("Deployed CappedRebase: ", CappedRebase.address)
    return CappedRebase.address
}

const deploy = async (deployer: SignerWithAddress, mainnet: boolean) => {
    console.log("Deploying")
    //const oracleAddrs = await deployOracles(deployer, mainnet)

    const CappedRebase = await deployCappedRebase(deployer, mainnet)

    console.log("DONE")

    //return [oracleAddrs, CappedRebase, nftController, od.VC_Implementation]

}

async function main() {
    let mainnet: boolean = false

    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        console.log("TEST DEPLOYMENT AT BLOCK: ", await (await currentBlock()).number)
    } else {
        console.log("DEPLOYING TO ", networkName)
        mainnet = true
    }


    const accounts = await ethers.getSigners()
    const deployer = accounts[0]
    console.log("Deployer: ", deployer.address)

    await deploy(deployer, mainnet)

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

//usdc relay = 0x84be5d42712da1129019B4f43F226295ec47FcF9
//capped rebase imp 0xd3451b8f2E8177Ee2BeCb842896289102544D89a
//capped rebase 0x6F7A2f0d9DBd284E274f28a6Fa30e8760C25F9D2