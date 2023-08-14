import { BN } from "../../../util/number";
import {
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory, USDI__factory
} from "../../../typechain-types";
import { ProposalContext } from "../suite/proposal";
import { currentBlock, fastForward, hardhat_mine, reset, resetCurrent } from "../../../util/block";
import * as fs from 'fs';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import hre from 'hardhat';
import { showBodyCyan } from "../../../util/format";
import { ceaseImpersonation } from "../../../util/impersonator";

const { ethers, network, upgrades } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const proposeFromScript = false
const proposerAddr = "0x958892b4a0512b28AaAC890FC938868BBD42f064"

const propose = async (proposer: SignerWithAddress) => {

  const proposal = new ProposalContext("GovThresholds")

  const out = proposal.populateProposal()
  const proposalText = fs.readFileSync('./scripts/proposals/govThresholds/txt.md', 'utf8');

  let gov: GovernorCharlieDelegate;
  gov = new GovernorCharlieDelegate__factory(proposer).attach(
    govAddress
  );

  //txt only proposal
  out.targets = ["0x0000000000000000000000000000000000000000"]//out.targets,
  out.values = [BN("0")]
  out.signatures = [""]
  out.calldatas = ["0x"]

  const data = await gov.connect(proposer).populateTransaction.propose(
    out.targets,
    out.values,
    out.signatures,
    out.calldatas,
    proposalText,
    false
  )


  if (proposeFromScript) {
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
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
      //test execution if on test network 
      console.log("Testing execution")
      await quickTest(proposer)
    }
  } else {
    console.log("TRANSACTION DATA: \n", data.data)
    //fs.writeFileSync('./scripts/proposals/MKR/proposalHexData.txt', JSON.stringify(data))
  }
  console.log(out)
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
  const whale = "0xa6e8772af29b29b9202a073f8e36f447689beef6"//"0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
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
    //await resetCurrent()
    await reset(17886985)
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

  await propose(proposer)


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
