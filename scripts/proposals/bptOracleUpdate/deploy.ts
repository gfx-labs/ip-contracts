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
    BPTstablePoolOracle__factory
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { MainnetBPTaddresses, a, c, d } from "../../../util/addresser"
import { currentBlock, reset, resetCurrent } from "../../../util/block";
import { network } from "hardhat";
import hre from 'hardhat'
import { BigNumber } from "ethers";
import { showBody, showBodyCyan } from "../../../util/format";
const { ethers } = require("hardhat");
const addrs = new MainnetBPTaddresses()

let updatedOracle: IOracleRelay


const deployOracle = async (deployer: SignerWithAddress, mainnet: boolean) => {

    //get data for existing deploy
    let poolAddress: string
    let balancerVault: string
    let tokens: string[] = [a.wstethAddress, a.wethAddress]
    let oracles: string[]
    let num: BigNumber
    let den: BigNumber

    const oracle = BPTstablePoolOracle__factory.connect(addrs.B_stETH_STABLEPOOL_ORACLE, deployer)
    poolAddress = await oracle._priceFeed()
    balancerVault = await oracle.VAULT()
    oracles = [await oracle.assetOracles(tokens[0]), await oracle.assetOracles(tokens[1])]
    num = await oracle._widthNumerator()
    const newBips = BN('50')
    den = await oracle._widthDenominator()

    updatedOracle = await new BPTstablePoolOracle__factory(deployer).deploy(
        poolAddress,
        balancerVault,
        tokens,
        oracles,
        newBips,
        den
    )
    /**
    ,
        {
            gasPrice: 50000000000, //gas price of 200 gwei - extreeemely high
            gasLimit: 1200000
          }
     */

    await updatedOracle.deployed()
    showBody("Deployed: ", updatedOracle.address)
    //new oracle reads price successfully
    showBodyCyan("PRICE: ", await toNumber(await updatedOracle.currentValue()))

    if (mainnet) {
        await updatedOracle.deployTransaction.wait(10)
        console.log("deployed, now verifying")
        await hre.run("verify:verify", {
            address: updatedOracle.address,
            constructorArguments: [
                poolAddress,
                balancerVault,
                tokens,
                oracles,
                newBips,
                den
            ],
        })
        console.log("verified")

    }

}

const deploy = async (deployer: SignerWithAddress, mainnet: boolean) => {

    await deployOracle(deployer, mainnet)

    console.log("oracle has been deployed successfully")

};

async function main() {
    let mainnet: boolean = false
    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
        console.log("TEST DEPLOYMENT AT BLOCK: ", await (await currentBlock()).number)
    } else {
        console.log("DEPLOYING TO MAINNET")
        mainnet = true
    }

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    console.log("Deployer: ", deployer.address)

    await deploy(deployer, mainnet)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
