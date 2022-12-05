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
    IVaultController__factory
} from "../typechain-types";
import { utils, BigNumber } from "ethers";

import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { showBody } from "../util/format";
import { reset, currentBlock } from "../util/block"
import { stealMoney } from "../util/money"
import exp from "constants";
import { expect } from "chai";

const { ethers, network, upgrades } = require("hardhat");

async function main() {
    await reset(16120270)

    const accounts = await ethers.getSigners();

    const deployer = accounts[0];

    const proposal = 13

    const GOV = IGovernorCharlieDelegate__factory.connect("0x266d1020A84B9E8B0ed320831838152075F8C4cA", deployer)

    const VC = VaultController__factory.connect("0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3", deployer)
    
    let enabledTokens = await VC.tokensRegistered()
    console.log("Tokens Registered before upgrade: ", enabledTokens)

    await GOV.execute(proposal)

    enabledTokens = await VC.tokensRegistered()
    console.log("Tokens Registered after upgrade: ", enabledTokens)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
