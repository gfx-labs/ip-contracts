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
  ThreeLines0_100__factory,
  CurveMaster__factory,
  ICurveMaster__factory,
  ThreeLines0_100
} from "../../../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  currentBlock
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../../util/deploy";
import { deployContract } from "ethereum-waffle";

let anchorLDO: UniswapV3TokenOracleRelay
let mainLDO: ChainlinkOracleRelay
let anchorViewLDO: AnchoredViewRelay

let anchorDYDX: UniswapV3TokenOracleRelay
let mainDYDX: ChainlinkOracleRelay
let anchorViewDYDX: AnchoredViewRelay

let anchorCRV: UniswapV3TokenOracleRelay
let mainCRV: ChainlinkOracleRelay
let anchorViewCRV: AnchoredViewRelay

const ZER0 = "0x0000000000000000000000000000000000000000"


//from contract at 0x16Ac44B1e161c735D7E372169d3573d920a23906
  //with expected values from forum
  const oldCurveData = {
    r0: BN("3000000000000000000"), //r1 - 0.5
    r1: BN("200000000000000000"),  //r2 - 20
    r2: BN("5000000000000000"),    //r3 - 300
    s1: BN("350000000000000000"),  //s1 - 65
    s2: BN("650000000000000000"),  //s2 - 35
  }

  //r1 = r0 is swapped with r3 = r2 ?
  //and s1/s2 are swapped

  const newCurveData = {
    r0: BN("2000000000000000000"), //r1 - 200% - 2
    r1: BN("100000000000000000"),  //r2 - 10%  - 0.1
    r2: BN("5000000000000000"),    //r3 - 0.5% - 0.005
    s1: BN("250000000000000000"),  //s1 - 25%  - 0.25
    s2: BN("500000000000000000"),  //s2 - 50%  - 0.50
  }

  /**
   * Direct from forum post - r1 == r0
   * In contract param order
   const newCurveData = {
    r1: BN("5000000000000000"),   //r1
    r2: BN("100000000000000000"), //r2
    r3: BN("2000000000000000000"),//r3
    s1: BN("500000000000000000"), //s1
    s2: BN("250000000000000000"), //s2
  } 
   
   * In forum order
  const newCurveData = {
    s1: BN("500000000000000000"), //s1
    s2: BN("250000000000000000"), //s2
    r1: BN("5000000000000000"),   //r1
    r2: BN("100000000000000000"), //r2
    r3: BN("2000000000000000000"),//r3
  }
   */


  /**
   * OG tests 
        BN("200e16"),
        BN("5e16"),
        BN("45e15"),
        BN("50e16"),
        BN("55e16")
   */


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
//	
describe("Deploy and setup new curve", () => {

  
  it("Verify old curve", async () => {
    const curveMasterAddr = await s.VaultController.getCurveMaster()

    s.Curve = ICurveMaster__factory.connect(curveMasterAddr, s.Frank)

    const curveAddress = await s.Curve._curves(ZER0)

    const oldLines = ThreeLines0_100__factory.connect(curveAddress, s.Frank)

    expect(await oldLines._r0()).to.eq(oldCurveData.r0, "r0 is correct")
    expect(await oldLines._r1()).to.eq(oldCurveData.r1, "r1 is correct")
    expect(await oldLines._r2()).to.eq(oldCurveData.r2, "r2 is correct")
    expect(await oldLines._s1()).to.eq(oldCurveData.s1, "s1 is correct")
    expect(await oldLines._s2()).to.eq(oldCurveData.s2, "s2 is correct")

  })

  it("Connect to new curve", async () => {

    //already deployed
    s.newLines = ThreeLines0_100__factory.connect("0x482855c43a0869D93C5cA6d9dc9EDdF3DAE031Ea", s.Frank)
  })
})




describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;
  gov = new GovernorCharlieDelegate__factory(prop).attach(
    governorAddress
  )
  let proposal: number

  let out: any

  it("Makes the new proposal", async () => {

    const proposal = new ProposalContext("NEW_CURVE")


    const registerNewCurve = await new CurveMaster__factory(prop).
      attach(s.Curve.address).
      populateTransaction.setCurve(
        ZER0,
        s.newLines.address
      )


    //set relays
    proposal.addStep(registerNewCurve, "setCurve(address,address)")

    out = proposal.populateProposal()
    //showBody(out)
  })


  it("propose, queue and execute", async () => {
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
      "Set New Curve",
      false
    )
    await mineBlock()
    proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await advanceBlockHeight(votingDelay.toNumber());

    await gov.connect(prop).castVote(proposal, 1)
    await mineBlock()

    showBodyCyan("Advancing a lot of blocks again...")
    await advanceBlockHeight(votingPeriod.toNumber());
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

describe("Verify new curve values", async () => {
  let currentLines: ThreeLines0_100
  it("Get lines", async () => {
    const curveMasterAddr = await s.VaultController.getCurveMaster()

    s.Curve = ICurveMaster__factory.connect(curveMasterAddr, s.Frank)

    const curveAddress = await s.Curve._curves(ZER0)

    currentLines = ThreeLines0_100__factory.connect(curveAddress, s.Frank)
  })

  it("Check values", async () => {
    expect(await currentLines._r0()).to.eq(newCurveData.r0, "r0 is correct")
    expect(await currentLines._r1()).to.eq(newCurveData.r1, "r1 is correct")
    expect(await currentLines._r2()).to.eq(newCurveData.r2, "r2 is correct")
    expect(await currentLines._s1()).to.eq(newCurveData.s1, "s1 is correct")
    expect(await currentLines._s2()).to.eq(newCurveData.s2, "s2 is correct")
  })

})