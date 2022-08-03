import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../util/impersonator"

import { BN } from "../../util/number";
import {
  ProxyAdmin,
  ProxyAdmin__factory,
  USDI__factory,
  IVault__factory,
  GovernorCharlieDelegate__factory
} from "../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  currentBlock,
} from "../../util/block";
import { toNumber } from "../../util/math";


require("chai").should();
//proposal 5 has already been made as of this block
describe("Queue and execute upgrade", () => {
  const proposal = 5
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064";
  const prop = ethers.provider.getSigner(proposer)

  const gov = GovernorCharlieDelegate__factory.connect(governorAddress, prop);

  it("Queue and execute", async () => {

    const START_TBL = await s.VaultController.totalBaseLiability()
    showBodyCyan("Starting TBL: ", await toNumber(START_TBL))



    const votingPeriod = await gov.emergencyVotingPeriod()
    const timelock = await gov.emergencyTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
    expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")


    await impersonateAccount(proposer)

    await gov.connect(prop).castVote(proposal, 1)
    showBody("Advancing a lot of blocks...")
    await advanceBlockHeight(votingPeriod.toNumber());
    await gov.connect(prop).queue(proposal);
    await mineBlock()
    await fastForward(timelock.toNumber());
    await gov.connect(prop).execute(proposal);
    await mineBlock();
    showBody("Executed")

    await ceaseImpersonation(proposer)


    const resultingTBL = await s.VaultController.totalBaseLiability()
    showBodyCyan("Ending TBL: ", await toNumber(resultingTBL))
    expect(await toNumber(resultingTBL)).to.be.lt(await toNumber(START_TBL) / 2, "Total Base Liability fixed")
  })
})
