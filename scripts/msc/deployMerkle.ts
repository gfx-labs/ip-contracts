import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CurveMaster__factory,
    ThreeLines0_100__factory,
    InterestProtocolTokenDelegate,
    WavePool,
    WavePool__factory,
    MerkleRedeem__factory,
} from "../typechain-types";
import { utils, BigNumber } from "ethers";
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { currentBlock, OneWeek, reset } from "../util/block";
import { DeployContract } from "../util/deploy"
import { wave1 } from "./deployment/wave1";
import { wave2 } from "./deployment/wave2";

const { ethers, network, upgrades } = require("hardhat");


async function main() {

    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    console.log("Deploying MerkleRedeem")

    const MerkleRedeem = await DeployContract(
        new MerkleRedeem__factory(deployer),
        deployer, 
        "0xd909C5862Cdb164aDB949D92622082f0092eFC3d"//IPT address
    )
    await MerkleRedeem.deployed()

    console.log("MerkleRedeem deployed to: ", MerkleRedeem.address)


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
