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
  ChainlinkOracleRelay__factory
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

  const bal3k = "0xDC2c21F1B54dDaF39e944689a8f90cb844135cc9"//bal/weth ~$280k liquidity, the only viable pool
  const balDataFeed = "0xdf2917806e30300537aeb49a7663062f4d1f2b5f"

  const aave3k = "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"//aave/weth ~$906k liqudiity, the best pool by far
  const aaveDataFeed = "0x547a514d5e3769680ce22b2361c10ea13619e8a9"


  let anchorBal: UniswapV3TokenOracleRelay
  let mainBal: ChainlinkOracleRelay
  let anchorViewBal: AnchoredViewRelay

  let anchorAave: UniswapV3TokenOracleRelay
  let mainAave: ChainlinkOracleRelay
  let anchorViewAave: AnchoredViewRelay

  let out: any
  it("Deploy Capped Aave", async () => {
    s.CappedAave = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedAave",
      "cAAVE",
      s.AAVE.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
    await s.CappedAave.deployed()
    await mineBlock()

    await s.CappedAave.connect(s.Frank).setCap(s.AaveCap)
    await mineBlock()
  })
  it("Deploy Capped Bal", async () => {
    s.CappedBal = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedBalancer",
      "cBAL",
      s.BAL.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
    await s.CappedBal.deployed()
    await mineBlock()

    await s.CappedBal.connect(s.Frank).setCap(s.BalCap)
    await mineBlock()
  })


  it("Deploy Oracle system for Bal", async () => {

    //uniV3Relay
    anchorBal = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      10000,
      bal3k,
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await anchorBal.deployed()
    await mineBlock()

    showBody("Format BAL price from anchor: ", await toNumber(await anchorBal.currentValue()))
    //showBody("Raw   : ", await anchorBal.currentValue())

    mainBal = await DeployContract(
      new ChainlinkOracleRelay__factory(s.Frank),
      s.Frank,
      balDataFeed,
      BN("1e10"),
      BN("1")
    )
    await mineBlock()
    await mainBal.deployed()
    await mineBlock()
    let price = await mainBal.currentValue()
    showBody("price: ", await toNumber(price))

    anchorViewBal = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      anchorBal.address,
      mainBal.address,
      BN("10"),
      BN("100")
    )
    await mineBlock()
    await anchorViewBal.deployed()
    await mineBlock()

    let result = await anchorViewBal.currentValue()
    showBody("BAL Result: ", await toNumber(result))
  })

  it("Deploy Oracle system for Aave", async () => {

    //uniV3Relay
    anchorAave = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      14400,
      aave3k,
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await anchorAave.deployed()
    await mineBlock()

    showBody("Format: ", await toNumber(await anchorAave.currentValue()))
    //showBody("Raw   : ", await anchorAave.currentValue())

    mainAave = await DeployContract(
      new ChainlinkOracleRelay__factory(s.Frank),
      s.Frank,
      aaveDataFeed,
      BN("1e10"),
      BN("1")
    )
    await mineBlock()
    await mainAave.deployed()
    await mineBlock()
    let price = await mainAave.currentValue()
    showBody("price: ", await toNumber(price))

    anchorViewAave = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      anchorAave.address,
      mainAave.address,
      BN("10"),
      BN("100")
    )
    await mineBlock()
    await anchorViewAave.deployed()
    await mineBlock()

    let result = await anchorViewAave.currentValue()
    showBody("AAVE Result: ", await toNumber(result))
  })


  it("Makes the new proposal", async () => {

    await impersonateAccount(proposer)

    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );

    const proposal = new ProposalContext("BAL&AAVE")

    const addOracleBal = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedBal.address,
        anchorViewBal.address
      )
    const addOracleAave = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedAave.address,
        anchorViewAave.address
      )


    const listBAL = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedBal.address,
        s.BalLTV,
        s.CappedBal.address,
        s.BalLiqInc
      )

    const listAave = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedAave.address,
        s.AaveLTV,
        s.CappedBal.address,
        s.AaveLiqInc
      )

    //register on voting vault controller
    const registerBAL_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.BAL.address,
        s.CappedBal.address
      )

    const registerAave_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.AAVE.address,
        s.CappedAave.address
      )


    proposal.addStep(addOracleBal, "setRelay(address,address)")
    proposal.addStep(addOracleAave, "setRelay(address,address)")

    proposal.addStep(listBAL, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(listAave, "registerErc20(address,uint256,address,uint256)")

    proposal.addStep(registerBAL_VVC, "registerUnderlying(address,address)")
    proposal.addStep(registerAave_VVC, "registerUnderlying(address,address)")



    out = proposal.populateProposal()
    //showBody(out)
    /** 
    
    {
      targets: [
        '0xf4818813045E954f5Dc55a40c9B60Def0ba3D477',
        '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3',
        '0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2'
      ],
      values: [ 0, 0, 0 ],
      signatures: [
        'setRelay(address,address)',
        'registerErc20(address,uint256,address,uint256)',
        'registerUnderlying(address,address)'
      ],
      calldatas: [
        '0x000000000000000000000000286b8decd5ed79c962b2d8f4346cd97ff0e2c3520000000000000000000000009338ca7d556248055f5751d85cda7ad6ef254433',
        '0x000000000000000000000000286b8decd5ed79c962b2d8f4346cd97ff0e2c3520000000000000000000000000000000000000000000000000a688906bd8b0000000000000000000000000000286b8decd5ed79c962b2d8f4346cd97ff0e2c352000000000000000000000000000000000000000000000000016345785d8a0000',
        '0x000000000000000000000000c18360217d8f7ab5e7c516566761ea12ce7f9d72000000000000000000000000286b8decd5ed79c962b2d8f4346cd97ff0e2c352'
      ]
    }
    */
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
      "List Bal & Aave",
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
})