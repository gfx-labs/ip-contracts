import { ProxyAdmin__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { CappedNonStandardToken__factory } from "../../typechain-types";
import { currentBlock, resetCurrent, resetCurrentOP } from "../../util/block";
import { DeployContract } from "../../util/deploy"
import hre from 'hardhat'
import { OptimisimDeploys } from "../../util/addresser";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
const d = new OptimisimDeploys()

const { ethers, network, upgrades } = require("hardhat");
const owner = ethers.provider.getSigner("0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89")
async function main() {
    
    const accounts = await ethers.getSigners();
    let deployer = accounts[0];

    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        console.log("TEST DEPLOYMENT AT BLOCK: ", await (await currentBlock()).number)
        await impersonateAccount(owner._address)
        deployer = owner
    } else {
        console.log("DEPLOYING TO OP AS: ", deployer.address)
    }
    
   
    const ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    await ProxyAdmin.transferOwnership(d.optimismMessenger)


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
