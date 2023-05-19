import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../../util/impersonator"
import * as fs from 'fs';

import { BN } from "../../../../../util/number";
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
  OracleRETH,
  BalancerPeggedAssetRelay,
  UniswapV2OracleRelay__factory,
  VaultController,
  ProxyAdmin__factory,
  CHI_Oracle__factory,
  IOracleRelay,
  UniswapV3OracleRelay__factory,
  WstETHRelay__factory,
  BPTstablePoolOracle__factory,
  CappedBptToken__factory
} from "../../../../../typechain-types";
import {
  advanceBlockHeight,
  hardhat_mine,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  currentBlock
} from "../../../../../util/block";
import { toNumber } from "../../../../../util/math";
import { ProposalContext } from "../../../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../../../util/deploy";


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
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not.reverted;
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






const wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
const B_stETH_STABLE = "0x32296969Ef14EB0c6d29669C550D4a0449130230"

let vvcImplementationAddr: String
let stEThMetaStablePoolOracle: IOracleRelay
let wstethRelay: IOracleRelay

describe("Upgrade Voting Vault Controller for BPT collateral", () => {
  it("Deploy new implementation", async () => {
    const implementation = await new VotingVaultController__factory(s.Frank).deploy()
    await mineBlock()
    await implementation.deployed()
    vvcImplementationAddr = implementation.address
  })
})
describe("Deploy Cap Tokens and Oracles", () => {
  const wethOracleAddr = "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"
  const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
  it("Deploy Capped wstETH_wETH", async () => {
    s.CappedWSTETH_wETH = await DeployContractWithProxy(
      new CappedBptToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedWSTETH/WETH",
      "cWSTETH/WETH",
      s.wstETH_wETH.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedWSTETH_wETH.connect(s.Frank).setCap(s.BPT_CAP)
  })

  //todo backup oracle/anchorView for wstETH
  it("Check wstETH exchange rate relay", async () => {
    wstethRelay = await new WstETHRelay__factory(s.Frank).deploy()
    await wstethRelay.deployed()
    //showBody("wstETH direct conversion price: ", await toNumber(await wstethRelay.currentValue()))
  })

  it("Deploy and check meta stable pool oracle", async () => {

    //wstETH/weth MetaStable pool
    stEThMetaStablePoolOracle = await new BPTstablePoolOracle__factory(s.Frank).deploy(
      B_stETH_STABLE, //pool_address
      balancerVault,
      [wstETH, s.wethAddress], //_tokens
      [wstethRelay.address, wethOracleAddr], //_oracles
      BN("20"),
      BN("10000")
    )
    await stEThMetaStablePoolOracle.deployed()

    showBodyCyan("stETh MetaStablePool BPT price: ", await toNumber(await (await stEThMetaStablePoolOracle.currentValue())))

  })
})




describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  let out: any

  it("Makes the new proposal", async () => {

    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );

    const proposal = new ProposalContext("B-stETH-STABLE-gauge")

    //upgrade VVC
    const upgradeVVC = await new ProxyAdmin__factory(prop).
      attach(s.ProxyAdmin.address).
      populateTransaction.upgrade(
        s.VotingVaultController.address,
        vvcImplementationAddr.toString()
      )

    const addOracle = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedWSTETH_wETH.address,
        stEThMetaStablePoolOracle.address
      )

    const list = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedWSTETH_wETH.address,
        s.BPT_LTV,
        s.CappedWSTETH_wETH.address,
        s.BPT_LiqInc
      )

    const register_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.wstETH_wETH.address,
        s.CappedWSTETH_wETH.address
      )

    //first time setup for VotingVault controller for BPTs
    const registerAuraBal = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerAuraBal("0x616e8BfA43F920657B3497DBf40D6b1A02D4608d")

    const registerAuraBooster = await new VotingVaultController__factory(prop).attach(s.VotingVaultController.address).
      populateTransaction.registerAuraBooster("0xA57b8d98dAE62B26Ec3bcC4a365338157060B234")

    //register LP data for new capped gauge token
    //this is so we can assosiate each listed gauge token with its reward token
    //reward token is what is recived for staking the gauge token
    //call PID on reward token to get PID
    const PID = BN("29")
    const gaugeToken = s.wstETH_wETH.address
    const rewardToken = "0xe4683Fe8F53da14cA5DAc4251EaDFb3aa614d528"
    
    const populateAuraLpData = await new VotingVaultController__factory(prop).attach(s.VotingVaultController.address).
      populateTransaction.registerAuraLpData(gaugeToken, rewardToken, PID)


    proposal.addStep(upgradeVVC, "upgrade(address,address)")
    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(register_VVC, "registerUnderlying(address,address)")
    proposal.addStep(registerAuraBal, "registerAuraBal(address)")
    proposal.addStep(registerAuraBooster, "registerAuraBooster(address)")
    proposal.addStep(populateAuraLpData, "registerAuraLpData(address,address,uint256)")

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
      "B-stETH-STABLE-gauge",
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



