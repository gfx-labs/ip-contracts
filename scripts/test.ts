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
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    IVaultController2__factory,
    IVaultController__factory,
    InterestProtocolTokenDelegate__factory,
    USDI__factory
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
import { ProposalContext } from "./proposals/suite/proposal";

import { tryNativeToHexString } from "@certusone/wormhole-sdk"

const { ethers, network, upgrades } = require("hardhat");

async function main() {
    console.log("TEST")
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await reset(16579397)
    await network.provider.send("evm_setAutomine", [true])



    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
    const feems = "0x6DD6934452eB4E6D87B9c874AE0EF83ec3bd5803"

    const proposal = new ProposalContext("GovThresholds")

    const transferUSDi = await new USDI__factory(deployer).attach("0x2A54bA2964C8Cd459Dc568853F79813a60761B58").populateTransaction.transfer(feems, BN("600e18"))

    proposal.addStep(transferUSDi, "transfer(address,uint256)")

    const out = proposal.populateProposal()

    let gov: GovernorCharlieDelegate;
    gov = new GovernorCharlieDelegate__factory(deployer).attach(
        governorAddress
    );

    const data = await gov.connect(deployer).populateTransaction.propose(
        out.targets,
        out.values,
        out.signatures,
        out.calldatas,
        "This is a proposal to transfer 600 USDi to feems.eth for administering and reporting duties under the Recognized Delegate Program.",
        false
    )

    console.log(out)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
