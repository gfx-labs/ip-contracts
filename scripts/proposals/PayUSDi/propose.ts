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
import { a, c, d } from "../../../util/addresser"
import { showBodyCyan } from "../../../util/format";
import * as fs from 'fs';
import { currentBlock, fastForward, hardhat_mine, resetCurrent } from "../../../util/block";
import hre from 'hardhat';
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { ceaseImpersonation } from "../../../util/impersonator";
const { ethers, network } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
/**
 * Use this script to make the proposal
 * Deployment of the Cap Token proxy and Anchored View Relay should already be complete
 * and testing with these deployments should have been done
 * 
 * If the first param proposeFromScript == false, the hex data that is output to the console
 * can be pasted into MetaMask as hex data 
 * when sending a transaction to Interest Protocol Governance 0x266d1020A84B9E8B0ed320831838152075F8C4cA
 * 
 * If proposeFromScript is true, the private key of the proposer must be
 * in .env as PERSONAL_PRIVATE_KEY=42bb...
 */

/*****************************CHANGE THESE/*****************************/
const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"//"0x958892b4a0512b28AaAC890FC938868BBD42f064"

//if true: 
//proposerAddr must have proposal power
//if true && running on a live network:
//PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...
const proposeFromScript = false


/***********************************************************************/

const proposeTOKEN = async (proposer: SignerWithAddress) => {
    const proposal = new ProposalContext("Pay USDI")

    const feemsAddr = "0x6DD6934452eB4E6D87B9c874AE0EF83ec3bd5803"
    const amount = BN("600e18")

    const pay = await new USDI__factory(proposer).attach(d.USDI).
        populateTransaction.transfer(
            feemsAddr,
            amount
        )

    proposal.addStep(pay, "transfer(address,uint256)")


    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/PayUSDi/txt.md', 'utf8');

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
    const networkName = hre.network.name
    if (proposeFromScript || networkName == "hardhat" || networkName == "localhost") {
        console.log("Sending proposal")
        const result = await gov.connect(proposer).propose(
            out.targets,
            out.values,
            out.signatures,
            out.calldatas,
            proposalText,
            false
        )
        const receipt = await result.wait()
        console.log("Proposal sent: ", receipt.transactionHash)
        if (networkName == "hardhat" || networkName == "localhost") {
            //test execution if on test network 
            console.log("Testing execution")
            await quickTest(proposer)
        }
    }

    if (!proposeFromScript || networkName == "hardhat" || networkName == "localhost") {
        console.log("TRANSACTION DATA: \n", data.data)
        //fs.writeFileSync('./scripts/proposals/MKR/proposalHexData.txt', JSON.stringify(data))
    }
}

const quickTest = async (proposer: SignerWithAddress) => {
    const gov = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()

    const proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber())

    await gov.connect(proposer).castVote(proposal, 1)

    await ceaseImpersonation(proposerAddr)
    const whale = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
    const prop = ethers.provider.getSigner(whale)
    await impersonateAccount(whale)
    await gov.connect(prop).castVote(proposal, 1)

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())

    await gov.connect(prop).queue(proposal)

    await fastForward(timelock.toNumber())

    const result = await gov.connect(prop).execute(proposal)
    await result.wait()
    showBodyCyan("EXECUTION COMPLETE")

    await ceaseImpersonation(whale)
}


async function main() {

    let proposer: SignerWithAddress


    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
        await impersonateAccount(proposerAddr)
        proposer = ethers.provider.getSigner(proposerAddr)
        console.log("TEST PROPOSAL AT BLOCK: ", await (await currentBlock()).number)

    } else {
        const accounts = await ethers.getSigners()
        proposer = accounts[1]
        if (proposeFromScript) {
            console.log("PROPOSING ON MAINNET AS: ", proposer.address)
        } else {
            console.log("GENERATING PROPOSAL TRANSACTION DATA")
        }
    }

    await proposeTOKEN(proposer)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

