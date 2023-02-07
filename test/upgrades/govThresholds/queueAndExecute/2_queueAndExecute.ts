import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"
import * as fs from 'fs';

import { BN } from "../../../../util/number";
import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  CappedGovToken__factory,
  UniswapV3TokenOracleRelay__factory,
  UniswapV3TokenOracleRelay,
  AnchoredViewRelay,
  AnchoredViewRelay__factory,
  OracleMaster__factory,
  VaultController__factory,
  VotingVaultController__factory,
  ChainlinkOracleRelay,
  ChainlinkOracleRelay__factory,
  ChainlinkTokenOracleRelay__factory,
  GeneralizedBalancerOracle,
  GeneralizedBalancerOracle__factory,
  OracleRETH,
  BalancerPeggedAssetRelay,
  UniswapV2OracleRelay__factory,
  VaultController,
  ProxyAdmin__factory,
  USDI__factory
} from "../../../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  currentBlock,
  hardhat_mine
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../../util/deploy";
import { OracleRETH__factory } from "../../../../typechain-types/factories/oracle/External/OracleRETH.sol/OracleRETH__factory";
import { BalancerPeggedAssetRelay__factory } from "../../../../typechain-types/factories/oracle/External/BalancerPeggedAssetRelay.sol";
import { BigNumber } from "ethers";

let anchorZRX: UniswapV3TokenOracleRelay
let mainZRX: ChainlinkOracleRelay
let anchorViewZRX: AnchoredViewRelay


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
  });
});




describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  let out: any

  let implementation: VaultController

  const feems = "0x6DD6934452eB4E6D87B9c874AE0EF83ec3bd5803"
  let feemsInit: BigNumber
  let initQuorum: BigNumber
  let initProposalThreshold: BigNumber

  const newProposalThreshold = BN("200000e18")
  const newQuorum = BN("2000000e18")

  before(async () => {
    gov = new GovernorCharlieDelegate__factory(s.Frank).attach(
      governorAddress
    );
    //set initial values for tracking
    feemsInit = await s.USDI.balanceOf(feems)
    initQuorum = await gov.quorumVotes()
    expect(await toNumber(initQuorum)).to.eq(10000000, "Initial quorum is correct")
    initProposalThreshold = await gov.proposalThreshold()
    expect(await toNumber(initProposalThreshold)).to.eq(1000000, "Initial proposal threshold is correct")
  })

  it("Makes the new proposal", async () => {

    await impersonateAccount(proposer)
    

    const proposal = new ProposalContext("GovThresholds")

    const setProposalThreshold = await new GovernorCharlieDelegate__factory(prop).
      attach(governorAddress).
      populateTransaction._setProposalThreshold(
        newProposalThreshold
      )

    const setQuorumThreshold = await new GovernorCharlieDelegate__factory(prop).
      attach(governorAddress).
      populateTransaction._setQuorumVotes(
        newQuorum
      )

    const transferUSDi = await new USDI__factory(prop).attach(s.USDI.address).populateTransaction.transfer(feems, BN("600e18"))

    proposal.addStep(setProposalThreshold, "_setProposalThreshold(uint256)")
    proposal.addStep(setQuorumThreshold, "_setQuorumVotes(uint256)")
    proposal.addStep(transferUSDi, "transfer(address,uint256)")

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
    expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")

    await impersonateAccount(proposer)
    await gov.connect(prop).propose(
      out.targets,
      out.values,
      out.signatures,
      out.calldatas,
      "Gov Proposal Thresholds",
      false
    )
    await mineBlock()
    proposal = Number(await gov.proposalCount())
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


  })

  it("Verify new gov proposal thresholds", async () => {
    let newfeems = await s.USDI.balanceOf(feems)
    expect(await toNumber(newfeems.sub(feemsInit))).to.eq(600, "Correct amount of USDi sent")

    let actualNewQuorum = await gov.quorumVotes()
    expect(actualNewQuorum).to.eq(newQuorum, "New quorum is correct")


    let actualNewPT = await gov.proposalThreshold()
    expect(actualNewPT).to.eq(newProposalThreshold, "New proposal threshold is correct")
  })

})
