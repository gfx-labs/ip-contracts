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
import { showBody, showBodyCyan } from "../../../util/format";
import { getGas, toNumber } from "../../../util/math";

import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

import * as fs from 'fs';
import { fastForward, hardhat_mine, mineBlock, resetCurrent } from "../../../util/block";
import hre from 'hardhat'
import { Signer } from "ethers";
import { start } from "repl";
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
    proposal.addStep(sendUSDI, "transfer(address,uint256)")


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
    await testProposal(proposal.populateProposal())
    //wait testImpersonation(proposer)


    
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

const testImpersonation = async (proposer: SignerWithAddress) => {

    const tx = {
        to: govAddress,
        value: BN("1e18")
    }
    await proposer.sendTransaction(tx)
    const gov = ethers.provider.getSigner(govAddress)
    await impersonateAccount(govAddress)
    const USDI = new USDI__factory(proposer).attach(
        d.USDI
    )
    console.log("SENDING")
    await USDI.connect(gov).transfer("0x6DD6934452eB4E6D87B9c874AE0EF83ec3bd5803", "1000000000000000")

    await ceaseImpersonation(govAddress)
}

const testProposal = async (data: any) => {
    const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
    const prop = ethers.provider.getSigner(proposer)

    const gov = new GovernorCharlieDelegate__factory(prop).attach(
        govAddress
    );
    const USDI = new USDI__factory(prop).attach(
        d.USDI
    )
    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const startBalance = await USDI.balanceOf(govAddress)
    await impersonateAccount(proposer)
    const result = await gov.connect(prop).propose(
        data.targets,
        data.values,
        data.signatures,
        data.calldatas,
        "List rETH",
        false
    )
    await mineBlock()
    const gas = await getGas(result)
    showBodyCyan("Gas to propose: ", gas)
    let proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber());

    await gov.connect(prop).castVote(proposal, 1)
    await mineBlock()

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber());
    await mineBlock()

    await gov.connect(prop).queue(proposal);
    await mineBlock()

    await fastForward(timelock.toNumber());
    await mineBlock()

    await gov.connect(prop).execute(proposal);
    await mineBlock();

    await ceaseImpersonation(proposer)
    const endBalance = await USDI.balanceOf(govAddress)
    console.log("DIF: ", await toNumber(startBalance.sub(endBalance)))
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

