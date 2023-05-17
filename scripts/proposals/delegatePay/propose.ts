import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, OracleMaster__factory,
    USDI__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../../../typechain-types";
import { ProposalContext } from "../suite/proposal";
import { d } from "../DeploymentInfo";
import { showBody } from "../../../util/format";
import * as fs from 'fs';
import { resetCurrent } from "../../../util/block";
import hre from 'hardhat'
const { ethers, network } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const amount = BN("600e18")
const feems = "0x6DD6934452eB4E6D87B9c874AE0EF83ec3bd5803"

const proposeFromScript = false

const propose = async (proposer: SignerWithAddress) => {
    const proposal = new ProposalContext("LIST TOKEN")

    const sendUSDI = await new USDI__factory().
        attach(d.USDI).
        populateTransaction.transfer(
            feems,
            amount
        )



    //list TOKEN
    proposal.addStep(sendUSDI, "setRelay(address,address)")


    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/delegatePay/txt.md', 'utf8');

    let gov: GovernorCharlieDelegate;
    gov = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    );

    const data = await gov.connect(proposer).populateTransaction.propose(
        out.targets,
        out.values,
        out.signatures,
        out.calldatas,
        proposalText,
        false
    )

    if (proposeFromScript) {
        console.log("Sending proposal from ", proposer.address)
        const result = await gov.connect(proposer).propose(
            out.targets,
            out.values,
            out.signatures,
            out.calldatas,
            proposalText,
            false
        )
    } else {
        console.log("TRANSACTION DATA: \n", data.data)
    }
}

async function main() {

    const accounts = await ethers.getSigners();
    const proposer = accounts[1];


    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST PROPOSAL")
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
    } else {
        console.log("PROPOSING ON MAINNET AS: ", proposer.address)
    }

    await propose(proposer)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

