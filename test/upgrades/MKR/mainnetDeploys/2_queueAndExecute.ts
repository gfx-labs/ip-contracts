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
  VaultController__factory,
  IOracleRelay__factory
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

describe("Setup proposal, queue, and execute", () => {

  let out: any

  it("Connect to deploys", async () => {
    CappedMkr = new CappedMkrToken__factory(s.Frank).attach("0xbb5578c08bC08c15AcE5cd09c6683CcCcB2A9148")
    mkrVotingVaultController = new MKRVotingVaultController__factory(s.Frank).attach("0x491397f7eb6f5d9B82B15cEcaBFf835bA31f217F")
    mkrOracle = IOracleRelay__factory.connect("0xCF2FCd9B87113139E809d5F9Ea6f4D571BB1C12a", s.Frank)
  })

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

  it("Temp set cap", async () => {

    const deployer = ethers.provider.getSigner("0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89")
    await impersonateAccount(deployer._address)
    await CappedMkr.connect(deployer).setCap(BN("11000e18"))
    await ceaseImpersonation(deployer._address)
  })

  it("Mint Vaults", async () => {
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not.reverted
    await mineBlock()
    s.BobVaultID = await s.VaultController.vaultsMinted()
    const vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
    s.BobVault = IVault__factory.connect(vaultAddress, s.Bob)
    expect(await s.BobVault.minter()).to.eq(s.Bob.address)

    await mkrVotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
    const mkrVaultAddr = await mkrVotingVaultController.votingVaultAddress(s.BobVaultID)
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

