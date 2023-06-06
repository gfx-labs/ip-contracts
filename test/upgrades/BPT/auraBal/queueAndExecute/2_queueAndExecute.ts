import { s } from "../scope";
import { ethers } from "hardhat";
import { expect } from "chai";
import { showBody, showBodyCyan } from "../../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../../util/impersonator"
import { BN } from "../../../../../util/number";
import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  UniswapV3TokenOracleRelay__factory,
  OracleMaster__factory,
  VaultController__factory,
  VotingVaultController__factory,
  ProxyAdmin__factory,
  IOracleRelay,
  CappedBptToken__factory,
  VotingVaultController,
  BPT_WEIGHTED_ORACLE__factory,
  AnchoredViewRelay__factory
} from "../../../../../typechain-types";
import {
  hardhat_mine,
  fastForward,
  currentBlock,
} from "../../../../../util/block";
import { getGas, toNumber } from "../../../../../util/math";
import { ProposalContext } from "../../../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy } from "../../../../../util/deploy";


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
    ;
    s.BobVaultID = await s.VaultController.vaultsMinted()
    let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
    s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
    expect(await s.BobVault.minter()).to.eq(s.Bob.address);

    //showBody("carol mint vault")
    await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
      .reverted;
    ;
    s.CaroLVaultID = await s.VaultController.vaultsMinted()
    vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
    s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
    expect(await s.CarolVault.minter()).to.eq(s.Carol.address);

    await s.WETH.connect(s.Carol).transfer(s.CarolVault.address, await s.WETH.balanceOf(s.Carol.address))
  });
});

let implementation: VotingVaultController
let impAddr: any

describe("Upgrade Voting Vault Controller for BPT collateral", () => {
  it("Deploy new implementation", async () => {
    implementation = await new VotingVaultController__factory(s.Frank).deploy()

    await implementation.deployed()
    impAddr = implementation.address
  })
})

let auraBalAnchorView: IOracleRelay
let uniAnchor: IOracleRelay
let primeBPToracle: IOracleRelay

describe("Deploy Cap Tokens and Oracles", () => {
  it("Deploy Capped AuraBal", async () => {
    s.CappedAuraBal = await DeployContractWithProxy(
      new CappedBptToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedAuraBal",
      "cAuraBal",
      s.AuraBal.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedAuraBal.connect(s.Frank).setCap(s.BPT_CAP)
  })

  it("AuraBal oracle system", async () => {
    const uniPool = "0xFdeA35445489e608fb4F20B6E94CCFEa8353Eabd"//3k, meh liquidity

    uniAnchor = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
      500,
      uniPool,
      false,
      BN("1"),
      BN("1")
    )

    await uniAnchor.deployed()
    //showBodyCyan("AuraBal uni relay price: ", await toNumber(await uniAnchor.currentValue()))
  })

  it("prime bpt oracle", async () => {
    const primeBPT = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56"
    const wethOracleAddr = "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"
    const BAL_TOKEN_ORACLE = "0xf5E0e2827F60580304522E2C38177DFeC7a428a4"
    const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"

    primeBPToracle = await new BPT_WEIGHTED_ORACLE__factory(s.Frank).deploy(
      primeBPT,
      [s.BAL.address, s.wethAddress],
      [BAL_TOKEN_ORACLE, wethOracleAddr]
    )
    await primeBPToracle.deployed()
    //showBody("Prime BPT oracle price: ", await toNumber(await primeBPToracle.currentValue()))  
  })

  it("Aura Bal anchor view", async () => {
    auraBalAnchorView = await new AnchoredViewRelay__factory(s.Frank).deploy(
      primeBPToracle.address,
      uniAnchor.address,
      BN("10"),
      BN("100")
    )
    await auraBalAnchorView.deployed()
    showBodyCyan("Aura Bal anchor view price: ", await toNumber(await auraBalAnchorView.currentValue()))
  })
})




const booster = "0xA57b8d98dAE62B26Ec3bcC4a365338157060B234"
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
      populateTransaction.upgrade(s.VotingVaultController.address, impAddr)

    //first time setup for VotingVault controller for BPTs
    const registerAuraBal = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerAuraBal(s.AuraBal.address)

    const registerAuraBooster = await new VotingVaultController__factory(prop).attach(s.VotingVaultController.address).
      populateTransaction.registerAuraBooster(booster)

    //register LP data for new capped BPT
    //this is so we can assosiate each listed BPT with its reward token
    //reward token is what is recived for staking the LP token via the booster
    //call PID on reward token to get PID
    const populateAuraLpData = await new VotingVaultController__factory(prop).attach(s.VotingVaultController.address).
      populateTransaction.registerAuraLpData(s.AuraBal.address, s.rewardToken.address, s.PID)

    const addOracle = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(s.CappedAuraBal.address, uniAnchor.address)

    const list = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(s.CappedAuraBal.address, s.BPT_LTV, s.CappedAuraBal.address, s.BPT_LiqInc)

    const register_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(s.AuraBal.address, s.CappedAuraBal.address)

    //test
    const calcInterest = await new VaultController__factory(prop).attach(s.VaultController.address).
      populateTransaction.calculateInterest()

    //upgrade and setup new features
    proposal.addStep(upgradeVVC, "upgrade(address,address)")
    proposal.addStep(registerAuraBal, "registerAuraBal(address)")
    proposal.addStep(registerAuraBooster, "registerAuraBooster(address)")
    proposal.addStep(populateAuraLpData, "registerAuraLpData(address,address,uint256)")

    //legacy listing arguments
    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(register_VVC, "registerUnderlying(address,address)")


    proposal.addStep(calcInterest, "calculateInterest()")


    out = proposal.populateProposal()
    //showBody(out)
  })

  it("reduce timelock to prevent reward payout error", async () => {
    /**
     * For some strange reason, fast forwarding more than this number prevents rewards from being paid
     * when redeeming auraBal rewards
     * 
     * For this reason, the timelock delay has been reduced for these tests
     * Rewards should still pay on mainnet when the normal timelock delay passes organicly 
     */
    //const magicNumber = BN("169718")
    const magicNumber = BN("14000")//BN("140000")
    await impersonateAccount(s.owner._address)
    await gov.connect(s.owner)._setDelay(magicNumber)
    await ceaseImpersonation(s.owner._address)

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
      "AuraBal",
      false
    )

    proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber());

    await gov.connect(prop).castVote(proposal, 1)

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber());

    await gov.connect(prop).queue(proposal);

    await fastForward(timelock.toNumber());

    const result = await gov.connect(prop).execute(proposal);
    const gas = await getGas(result)
    showBodyCyan("Gas to execute: ", gas)

    await ceaseImpersonation(proposer)

  })


  /**
  it("test more things", async () => {
    const blockTime = 15
    const votingDelay = BN("13140")
    const votingPeriod = BN("40320")
    const timelock = BN("172800")
    const magicNumber = BN("169718")
    //await hardhat_mine_timed(votingDelay.toNumber(), blockTime);
    //await hardhat_mine_timed(votingPeriod.toNumber(), blockTime);
    await hardhat_mine(votingDelay.toNumber())
    await hardhat_mine(votingDelay.toNumber())

    let block = await currentBlock()
    let beginTime = block.timestamp

    // mine a new block with timestamp `newTimestamp`
    //await time.increaseTo(beginTime + timelock.toNumber());

    // set the timestamp of the next block but don't mine a new block
    await fastForward(magicNumber.toNumber())

    //await hardhat_mine_timed(timelock.toNumber(), 0)
    //await advanceBlockHeight(timelock.toNumber())
    //await fastForward(magicNumber.toNumber())
    //await advanceBlockHeight(2)



    //await hardhat_mine_timed(timelock.toNumber() / blockTime, blockTime)
    //await fastForward(timelock.toNumber());

    let endBlock = await currentBlock()
    let endTime = endBlock.timestamp
    let difference = endTime - beginTime
    showBody("Dif: ", difference)

  })



  it("TEST do some things manually instead of preposal", async () => {
    await impersonateAccount(s.owner._address)

    await s.ProxyAdmin.connect(s.owner).upgrade(s.VotingVaultController.address, impAddr)

    await s.VotingVaultController.connect(s.owner).registerAuraBal(s.AuraBal.address)

    await s.VotingVaultController.connect(s.owner).registerAuraBooster(booster)

    // call pid on reward token to get pid
    await s.VotingVaultController.connect(s.owner).registerAuraLpData(s.AuraBal.address, s.rewardToken.address, s.PID)

    //register oracle
    await s.Oracle.connect(s.owner).setRelay(s.CappedAuraBal.address, uniAnchor.address)

    //register VVC
    await s.VotingVaultController.connect(s.owner).registerUnderlying(s.AuraBal.address, s.CappedAuraBal.address)

    //register on vault controller

    await s.VaultController.connect(s.owner).registerErc20(s.CappedAuraBal.address, s.BPT_LTV, s.CappedAuraBal.address, s.BPT_LiqInc)


    await ceaseImpersonation(s.owner._address)
  })

   */







})




