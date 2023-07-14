import { s } from "../scope";
import { ethers } from "hardhat";
import { expect } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  CappedGovToken__factory,
  OracleMaster__factory,
  VaultController__factory,
  VotingVaultController__factory,
  IOracleRelay,
  TransparentUpgradeableProxy__factory
} from "../../../../typechain-types";
import {
  hardhat_mine,
  fastForward,
  mineBlock,
  currentBlock
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal";

let chaiAnchor: IOracleRelay



require("chai").should();
describe("Verify Contracts", () => {
  it("Should return the right name, symbol, and decimals", async () => {

    expect(await s.USDI.name()).to.equal("USDI Token");
    expect(await s.USDI.symbol()).to.equal("USDI");
    expect(await s.USDI.decimals()).to.equal(18);
    //expect(await s.USDI.owner()).to.equal(s.Frank.address);
    //s.owner = await s.USDI.owner()
    s.pauser = await s.USDI.pauser()
  });


  it("Check data on VaultControler", async () => {
    let tokensRegistered = await s.VaultController.tokensRegistered()
    expect(tokensRegistered).to.be.gt(0)
    let interestFactor = await s.VaultController.interestFactor()
    expect(await toNumber(interestFactor)).to.be.gt(1)

  });

  it("mint vaults for testing", async () => {
    //showBody("bob mint vault")
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
      .reverted;
    await mineBlock();
    s.BobVaultID = await s.VaultController.vaultsMinted()
    let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
    s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
    expect(await s.BobVault.minter()).to.eq(s.Bob.address);

    //showBody("carol mint vault")
    await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
      .reverted;
    await mineBlock();
    s.CaroLVaultID = await s.VaultController.vaultsMinted()
    vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
    s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
    expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
    await s.WETH.connect(s.Carol).transfer(s.CarolVault.address, await s.WETH.balanceOf(s.Carol.address))

  });
});



describe("Deploy Cap Tokens and Oracles", () => {

  const cCHAIaddr = "0xDdAD1d1127A7042F43CFC209b954cFc37F203897"
  const oldImp = "0xB9cb624D4b21E0239bB149B1B1F1992A0eB351b8"

  it("Set capped chai to old implementation", async () => {

    s.CappedCHAI = CappedGovToken__factory.connect(cCHAIaddr, s.Frank)

    const proxy = TransparentUpgradeableProxy__factory.connect(cCHAIaddr, s.Frank)

    await impersonateAccount(s.deployer._address)
    showBodyCyan("TRYING")
    await s.CappedCHAI.connect(s.deployer).transferOwnership(s.owner._address)
    await ceaseImpersonation(s.deployer._address)

    /**
     await impersonateAccount(s.owner._address)
    s.ProxyAdmin.connect(s.owner).upgrade(s.CappedCHAI.address, oldImp)
    await ceaseImpersonation(s.owner._address)
     */

  })




})



describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const deployer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"
  const proposer = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"//"0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  let out: any

  const deployedOracle = "0x9Aa2Ccb26686dd7698778599cD0f4425a5231e18"


  it("Check votes", async () => {

    const votes = await s.IPT.getCurrentVotes(prop._address)
    showBody("Votes: ", await toNumber(votes))

  })


  it("Makes the new proposal", async () => {

    await impersonateAccount(proposer)
    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );

    const proposal = new ProposalContext("CHAI")

    const addOracleCHAI = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedCHAI.address,
        deployedOracle
      )

    const listCHAI = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedCHAI.address,
        s.CHAI_LTV,
        s.CappedCHAI.address,
        s.CHAI_LiqInc
      )

    const registerCHAI_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.CHAI.address,
        s.CappedCHAI.address
      )






    //list CHAI
    proposal.addStep(addOracleCHAI, "setRelay(address,address)")
    proposal.addStep(listCHAI, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerCHAI_VVC, "registerUnderlying(address,address)")




    await ceaseImpersonation(proposer)

    out = proposal.populateProposal()
    //showBody(out)


  })




  it("queue and execute", async () => {
    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
    //expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")

    await impersonateAccount(proposer)
    await gov.connect(prop).propose(
      out.targets,
      out.values,
      out.signatures,
      out.calldatas,
      "List CHAI",
      false
    )
    await mineBlock()
    proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber());

    await gov.connect(prop).castVote(proposal, 1)
    await mineBlock()
    await ceaseImpersonation(proposer)

    await impersonateAccount(deployer)
    const dep = ethers.provider.getSigner(deployer)
    await gov.connect(dep).castVote(proposal, 1)
    await ceaseImpersonation(deployer)

    await impersonateAccount(proposer)

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




  })

})

