import { s } from "../scope"
import { expect } from "chai"
import { showBody, showBodyCyan } from "../../../../util/format"
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number"
import {
  IVault__factory,
  CappedMkrToken__factory,
  IOracleRelay,
  TransparentUpgradeableProxy__factory,
  CappedMkrToken,
  ProxyAdmin__factory,
  MKRVotingVaultController,
  MKRVotingVaultController__factory,
  UniswapV3TokenOracleRelay__factory,
  ChainlinkOracleRelay__factory,
  AnchoredViewRelay__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  OracleMaster__factory,
  VaultController__factory
} from "../../../../typechain-types"
import {
  currentBlock,
  fastForward,
  hardhat_mine,
  mineBlock,
} from "../../../../util/block"
import { toNumber } from "../../../../util/math"
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal"
import { ethers } from "hardhat"

require("chai").should()

let CappedMkr: CappedMkrToken
let mkrVotingVaultController: MKRVotingVaultController
let mkrOracle: IOracleRelay
const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const mkrLTV = BN("7e17")
const mkrLiqInc = BN("5e16")

describe("Deploy Cap Tokens and Oracles", () => {


  it("Deploy Mkr Voting Controller", async () => {
    //deploy implementation
    const ucMVVC = await new MKRVotingVaultController__factory(s.Frank).deploy()
    await ucMVVC.deployed()

    //deploy proxy
    const cMVVC = await new TransparentUpgradeableProxy__factory(s.Frank).deploy(
      ucMVVC.address,
      s.ProxyAdmin.address,
      "0x"
    )
    await cMVVC.deployed()

    mkrVotingVaultController = new MKRVotingVaultController__factory(s.Frank).attach(cMVVC.address)
    await mkrVotingVaultController.initialize(s.VaultController.address)

    //transfer ownership for proposal
    await mkrVotingVaultController.connect(s.Frank).transferOwnership(govAddress)
  })


  it("Deploy Capped MKR and VotingVaultController", async () => {

    //deploy implementation
    const ucMKR = await new CappedMkrToken__factory(s.Frank).deploy()
    await ucMKR.deployed()

    //deploy proxy
    const cMKR = await new TransparentUpgradeableProxy__factory(s.Frank).deploy(
      ucMKR.address,
      s.ProxyAdmin.address,
      "0x"
    )
    await cMKR.deployed()

    CappedMkr = new CappedMkrToken__factory(s.Frank).attach(cMKR.address)
    await CappedMkr.initialize(
      "Maker",
      "MKR",
      s.MKR.address,
      s.VaultController.address,
      mkrVotingVaultController.address
    )

    await CappedMkr.setCap(s.MKR_AMOUNT)
  })

  it("Deploy oracle system for Capped MKR", async () => {

    const uniRelay = "0xe8c6c9227491C0a8156A0106A0204d881BB7E531"
    const clRelay = "0xec1d1b3b0443256cc3860e24a46f108e699484aa"

    const mkrUniRelay = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
      14400,
      uniRelay,
      false,
      BN("1"),
      BN("1")
    )
    await mkrUniRelay.deployed()
    //showBodyCyan("Uni Relay Price: ", await toNumber(await mkrUniRelay.currentValue()))

    const mkrClRelay = await new ChainlinkOracleRelay__factory(s.Frank).deploy(
      clRelay,
      BN("1e10"),
      BN("1")
    )
    await mkrClRelay.deployed()
    //showBodyCyan("CL Relay Price: ", await toNumber(await mkrClRelay.currentValue()))

    mkrOracle = await new AnchoredViewRelay__factory(s.Frank).deploy(
      mkrUniRelay.address,
      mkrClRelay.address,
      BN("10"),
      BN("100")
    )
    await mkrOracle.deployed()
    showBodyCyan("Mkr Oracle Price: ", await toNumber(await mkrOracle.currentValue()))

  })

})

describe("Setup proposal, queue, and execute", () => {


  let out: any

  it("Construct proposal", async () => {
    const proposal = new ProposalContext("MKR")

    const addOracle = await new OracleMaster__factory().
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        CappedMkr.address,
        mkrOracle.address
      )

    const list = await new VaultController__factory().
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        CappedMkr.address,
        mkrLTV,
        CappedMkr.address,
        mkrLiqInc
      )

    const register = await new MKRVotingVaultController__factory().
      attach(mkrVotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.MKR.address,
        CappedMkr.address
      )

    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(register, "registerUnderlying(address,address)")

    out = proposal.populateProposal()
  })

  it("Propose, queue, and execute", async () => {

    const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 "
    const prop = ethers.provider.getSigner(proposer)
    const gov: GovernorCharlieDelegate = new GovernorCharlieDelegate__factory(s.Frank).attach(govAddress)


    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    await impersonateAccount(proposer)
    await gov.connect(prop).propose(
      out.targets,
      out.values,
      out.signatures,
      out.calldatas,
      "PROPOSAL TEXT",
      false
    )
    await mineBlock()
    const proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber())

    await gov.connect(prop).castVote(proposal, 1)
    await mineBlock()

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())
    await mineBlock()

    await gov.connect(prop).queue(proposal)
    await mineBlock()

    await fastForward(timelock.toNumber())
    await mineBlock()

    await gov.connect(prop).execute(proposal)
    await mineBlock()

    await ceaseImpersonation(proposer)
  })
})

describe("Verify", () => {

  it("Mint Vaults", async () => {
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not.reverted
    await mineBlock()
    s.BobVaultID = await s.VaultController.vaultsMinted()
    const vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
    s.BobVault = IVault__factory.connect(vaultAddress, s.Bob)
    expect(await s.BobVault.minter()).to.eq(s.Bob.address)

    await mkrVotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
  })

  it("Deposit and verify borrow power", async () => {

    await s.MKR.connect(s.Bob).approve(CappedMkr.address, s.MKR_AMOUNT)
    await CappedMkr.connect(s.Bob).deposit(s.MKR_AMOUNT, s.BobVaultID)

    const borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

    let balance = await CappedMkr.balanceOf(s.BobVault.address)
    let price = await s.Oracle.getLivePrice(CappedMkr.address)
    const value = (balance.mul(price)).div(BN("1e18"))
    const expectedBorrowPower = value.mul(mkrLTV).div(BN("1e18"))

    expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(expectedBorrowPower), 0.1, "Borrow power is correct")
  })

  it("Withdraw", async () => {
    const startMKR = await s.MKR.balanceOf(s.Bob.address)
    expect(startMKR).to.eq(0, "Bob holds 0 MKR")

    await s.BobVault.connect(s.Bob).withdrawErc20(CappedMkr.address, s.MKR_AMOUNT)

    let balance = await s.MKR.balanceOf(s.Bob.address)
    expect(balance).to.eq(s.MKR_AMOUNT, "Bob received the MKR")

  })
})

