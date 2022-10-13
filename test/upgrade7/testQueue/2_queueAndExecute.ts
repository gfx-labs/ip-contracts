import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import * as fs from 'fs';

import { BN } from "../../../util/number";
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
} from "../../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  currentBlock
} from "../../../util/block";
import { toNumber } from "../../../util/math";
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../util/deploy";

const proposalText = fs.readFileSync('test/upgrade6/queueAndExecute/proposal.md', 'utf8');


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

  it("Connect to deployed contracts", async () => {
    s.CappedBal = CappedGovToken__factory.connect("0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85", s.Frank)
    s.CappedAave = CappedGovToken__factory.connect("0xd3bd7a8777c042De830965de1C1BCC9784135DD2", s.Frank)

    anchorViewBal = AnchoredViewRelay__factory.connect("0xf5E0e2827F60580304522E2C38177DFeC7a428a4", s.Frank)
    anchorViewAave = AnchoredViewRelay__factory.connect("0x27FC4059860F3d9758DCC9a871838F06333fc6ed", s.Frank)

    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );
    
  })

  it("queue and execute", async () => {
    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
    expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")

    await impersonateAccount(proposer)

    await mineBlock()
    proposal = Number(await gov.proposalCount())
    showBody("proposal num: ", proposal)

    await gov.connect(prop).queue(proposal);
    await mineBlock()

    await fastForward(timelock.toNumber());
    await mineBlock()

    await gov.connect(prop).execute(proposal);
    await mineBlock();

    await ceaseImpersonation(proposer)

  })
})