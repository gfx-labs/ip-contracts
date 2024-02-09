import { network } from "hardhat";
import hre from 'hardhat';
import { currentBlock, hardhat_mine, hardhat_mine_timed, resetCurrentOP } from "../../../util/block";
import { Deployment, DeploymentInfo } from "./optimisimDeployment";
import { BN } from "../../../util/number";
import { showBody, showBodyCyan } from "../../../util/format";
import { getGas, toNumber } from "../../../util/math"
import { SignKeyObjectInput } from "crypto";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { OptimisimAddresses, OptimisimDeploys } from "../../../util/addresser";
import { CrossChainAccount__factory, IUniV3Pool__factory, OracleMaster__factory, VaultController__factory } from "../../../typechain-types";
const { ethers } = require("hardhat");
const deployerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
const mainnetIPT = "0xd909C5862Cdb164aDB949D92622082f0092eFC3d"
const newL2IPT = "0xa211E25F7246950E0cCe054e3161C7c0b6379485"
const oldIPT = "0x4ea5eC30487132328616dBa55E46346CA840B685"
let deployer: SignerWithAddress
async function main() {
    console.log("START")
    const deploys = new OptimisimDeploys()
    const addresses = new OptimisimAddresses()

    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST DEPLOYMENT: ", networkName)
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        const block = await currentBlock()
        console.log("Deploying on OPTIMISM as of block: ", block.number)
        await impersonateAccount(deployerAddr)
        deployer = ethers.provider.getSigner(deployerAddr)
        console.log("Deployer: ", deployerAddr)
    } else {
        console.log("DEPLOYING TO: ", networkName)
        let accounts = await ethers.getSigners();
        deployer = accounts[0]
        console.log("Deployer: ", deployer.address)
    }

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
