import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Deployment, DeploymentInfo } from "./deployment/deployment";
import {
    CurveMaster__factory,
    OracleMaster__factory,
    ThreeLines0_100__factory,
    UniswapV3OracleRelay__factory,
    VaultController__factory,
    CappedGovToken__factory,
    IOracleRelay__factory,
    IGovernorCharlieDelegate__factory,
    IVaultController2__factory,
    IVaultController__factory,
    InterestProtocolTokenDelegate__factory
} from "../typechain-types";
import { utils, BigNumber } from "ethers";

import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { showBody } from "../util/format";
import { reset, currentBlock, mineBlock } from "../util/block"
import { stealMoney } from "../util/money"
import exp from "constants";
import { expect } from "chai";
import { toNumber } from "../util/math";

const { ethers, network, upgrades } = require("hardhat");

async function main() {
    //await reset(16430044)

    const accounts = await ethers.getSigners();

    const deployer = accounts[0];

    const imp = await new InterestProtocolTokenDelegate__factory(deployer).deploy()
    //console.log("Deployed implementation to: ", imp.address)

    /**
    await mineBlock()
    await imp.deployed()

     */

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
