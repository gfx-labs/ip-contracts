import { s } from "../scope";
import { expect } from "chai";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator";

import {
  IVault__factory, InterestProtocolToken__factory,
  InterestProtocolTokenDelegate__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory
} from "../../../../typechain-types";
import {
  mineBlock, currentBlock, hardhat_mine, fastForward
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";
import { ethers } from "hardhat";
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal";
import { d } from "../../../../util/addresser"
import { BN } from "../../../../util/number";
import { showBody, showBodyCyan } from "../../../../util/format";

describe("Perform Upgrade", () => {
  let newImpAddr: string
  let existingImplementation: string
  it("Deploy new implementation", async () => {

    const newImp = await new InterestProtocolTokenDelegate__factory(s.Frank).deploy()
    newImpAddr = newImp.address

    //get existing imp
    existingImplementation = await s.IPT.implementation()
    console.log(existingImplementation)

  })
  const illegalAddr = "0x41173311aB332fb08d2B0bB9398aE6d178B3aDAf"
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  const proposer = "0x5fee8d7d02B0cfC08f0205ffd6d6B41877c86558"
  const prop = ethers.provider.getSigner(proposer)
  let proposalId: number
  let out: any

  it("setup the proposal", async () => {

    const amount = await s.IPT.balanceOf(illegalAddr)
    showBody("IPT had: ", amount)

    await impersonateAccount(proposer)

    const proposal = new ProposalContext("eminent domain")

    //set new implementation
    const setImp = await new InterestProtocolToken__factory(prop).
      attach(d.IPT).
      populateTransaction._setImplementation(newImpAddr)

    //do the transfer
    const eminentDomain = await new InterestProtocolTokenDelegate__factory(prop).
      attach(d.IPT).
      populateTransaction.eminentDomain(illegalAddr, governorAddress, amount)

    //revert to old implementation
    const revertImp = await new InterestProtocolToken__factory(prop).
      attach(d.IPT).
      populateTransaction._setImplementation(existingImplementation)

    proposal.addStep(setImp, "_setImplementation(address)")
    proposal.addStep(eminentDomain, "eminentDomain(address,address,uint96)")
    proposal.addStep(revertImp, "_setImplementation(address)")
    await ceaseImpersonation(proposer)
    out = proposal.populateProposal()

  })

  it("propose, queue, execute", async () => {
    let gov: GovernorCharlieDelegate = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    )
    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
    showBody(await toNumber(votes))

    await impersonateAccount(proposer)
    await gov.connect(prop).propose(
      out.targets,
      out.values,
      out.signatures,
      out.calldatas,
      "List OETH",
      false
    )
    proposalId = Number(await gov.proposalCount())

    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber())

    await gov.connect(prop).castVote(proposalId, 1)

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())

    await gov.connect(prop).queue(proposalId)

    await fastForward(timelock.toNumber())

    //impersonate account and send IPTs away before execute
    await impersonateAccount(illegalAddr)
    //fund villan
    const tx = {
      to: illegalAddr,
      value: BN("1e17")
    }
    await s.Frank.sendTransaction(tx)
    const villan = ethers.provider.getSigner(illegalAddr)
    await s.IPT.connect(villan).transfer(s.Frank.address, await s.IPT.balanceOf(illegalAddr))
    await expect(gov.execute(proposalId)).to.reverted 
    //send it back
    await ceaseImpersonation(illegalAddr)
    await s.IPT.connect(s.Frank).transfer(illegalAddr, await s.IPT.balanceOf(s.Frank.address))

    await gov.execute(proposalId)

    await ceaseImpersonation(proposer)

    
  })

  it("Verify", async () => {
    //verify
    expect(await s.IPT.balanceOf(illegalAddr)).to.eq(0, "IPT taken")
    expect(await s.IPT.implementation()).to.eq(existingImplementation, "Implementation set correctly")

    //confirm IPT transfer after execution
    const startHolderBalance = await s.IPT.balanceOf(proposer)
    const startReceiverBalance = await s.IPT.balanceOf(s.Frank.address)
    expect(startHolderBalance).to.be.gt(0, "proposer has IPT")
    expect(startReceiverBalance).to.eq(0, "receiver has 0 IPT")

    const testAmount = BN("50e18")

    const holder = ethers.provider.getSigner(proposer)
    await impersonateAccount(proposer)
    await s.IPT.connect(holder).transfer(s.Frank.address, testAmount)
    await ceaseImpersonation(proposer)

    const endReceiverBalance = await s.IPT.balanceOf(s.Frank.address)
    expect(endReceiverBalance).to.eq(testAmount, "transfer success")

    //test delegate
    await s.IPT.connect(s.Frank).delegate(s.Bob.address)

    expect(await s.IPT.getCurrentVotes(s.Bob.address)).to.eq(testAmount, "delegate successs")

    
    

  })

})