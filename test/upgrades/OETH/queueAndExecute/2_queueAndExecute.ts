import { s } from "../scope"
import { ethers } from "hardhat"
import { expect } from "chai"
import { showBody, showBodyCyan } from "../../../../util/format"
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"
import { a, d } from "../../../../util/addresser"

import { BN } from "../../../../util/number"
import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  CappedGovToken__factory,
  UniswapV3TokenOracleRelay__factory, AnchoredViewRelay__factory,
  OracleMaster__factory,
  VaultController__factory,
  VotingVaultController__factory, IOracleRelay, ChainlinkOracleRelay__factory, CappedWOETH__factory, VotingVault__factory, CappedERC4626__factory
} from "../../../../typechain-types"
import {
  hardhat_mine,
  fastForward,
  mineBlock, currentBlock
} from "../../../../util/block"
import { getGas, toNumber } from "../../../../util/math"
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal"
import { DeployContractWithProxy } from "../../../../util/deploy"

let anchorViewOETH: IOracleRelay

require("chai").should()
describe("Verify Contracts", () => {
  it("Should return the right name, symbol, and decimals", async () => {

    expect(await s.USDI.name()).to.equal("USDI Token")
    expect(await s.USDI.symbol()).to.equal("USDI")
    expect(await s.USDI.decimals()).to.equal(18)
    //expect(await s.USDI.owner()).to.equal(s.Frank.address)
    //s.owner = await s.USDI.owner()
  })


  it("Check data on VaultControler", async () => {
    let tokensRegistered = await s.VaultController.tokensRegistered()
    expect(tokensRegistered).to.be.gt(0)
    let interestFactor = await s.VaultController.interestFactor()
    expect(await toNumber(interestFactor)).to.be.gt(1)

  })

  it("mint vaults for testing", async () => {
    //showBody("bob mint vault")
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
      .reverted
    s.BobVaultID = await s.VaultController.vaultsMinted()
    let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
    s.BobVault = IVault__factory.connect(vaultAddress, s.Bob)
    expect(await s.BobVault.minter()).to.eq(s.Bob.address)

    //showBody("carol mint vault")
    await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
      .reverted
    s.CaroLVaultID = await s.VaultController.vaultsMinted()
    vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
    s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol)
    expect(await s.CarolVault.minter()).to.eq(s.Carol.address)

    await s.WETH.connect(s.Carol).transfer(s.CarolVault.address, await s.WETH.balanceOf(s.Carol.address))
  })

  it("Mint voting vault for Bob", async () => {

    let _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
    expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

    const result = await s.VotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)

    let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
    s.BobVotingVault = VotingVault__factory.connect(vaultAddr, s.Bob)

    expect(s.BobVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Bob's voting vault setup complete")
  })
  it("Mint voting vault for Carol", async () => {

    let _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(s.CaroLVaultID)
    expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

    const result = await s.VotingVaultController.connect(s.Carol).mintVault(s.CaroLVaultID)

    let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.CaroLVaultID)
    s.CarolVotingVault = VotingVault__factory.connect(vaultAddr, s.Carol)

    expect(s.CarolVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Carol's voting vault setup complete")
  })

  it("Bob's Voting Vault setup correctly", async () => {
    const vaultInfo = await s.BobVotingVault._vaultInfo()
    const parentVault = await s.BobVotingVault.parentVault()

    expect(parentVault.toUpperCase()).to.eq(vaultInfo.vault_address.toUpperCase(), "Parent Vault matches vault info")

    expect(vaultInfo.id).to.eq(s.BobVaultID, "Voting Vault ID is correct")
    expect(vaultInfo.vault_address).to.eq(s.BobVault.address, "Vault address is correct")
  })
  it("Carol's Voting Vault setup correctly", async () => {
    const vaultInfo = await s.CarolVotingVault._vaultInfo()

    expect(vaultInfo.id).to.eq(s.CaroLVaultID, "Voting Vault ID is correct")
    expect(vaultInfo.vault_address).to.eq(s.CarolVault.address, "Vault address is correct")
  })

})






describe("Deploy Cap Tokens and Oracles", () => {

  it("Deploy capped wOETH", async () => {
    s.CappedWOETH = await DeployContractWithProxy(
      new CappedERC4626__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedWOETH",
      "cwOETH",
      s.wOETH.address,
      s.OETH.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedWOETH.deployed()

    await s.CappedWOETH.connect(s.Frank).setCap(s.OETH_CAP)

    await s.CappedWOETH.connect(s.Frank).transferOwnership(s.owner._address)
  })

  /**
  it("Deploy OETH oracle system", async () => {

    //chainOETH oracle
    const chainOETHDataFeed = "0xa027702dbb89fbd58938e4324ac03b58d812b0e1"

    const chainOETHRelay = await new ChainlinkOracleRelay__factory(s.Frank).deploy(
      chainOETHDataFeed,
      BN("1e10"),
      BN("1")
    )
    await chainOETHRelay.deployed()
    showBody("ChainOETH data feed price: ", await toNumber(await chainOETHRelay.currentValue()))

    //uni v3 oracle
    const uniPool = "0x2E8dAf55F212BE91D3fA882ccEAb193A08fddeB2"//10k OETH/wETH pool
    const uniRelay = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
      14400,
      uniPool,
      false,
      BN("1"),
      BN("1")
    )
    await uniRelay.deployed()
    showBody("uni v3 relay price: ", await toNumber(await uniRelay.currentValue()))


    anchorViewOETH = await new AnchoredViewRelay__factory(s.Frank).deploy(
      uniRelay.address,
      chainOETHRelay.address,
      BN("5"),
      BN("100")
    )
    await anchorViewOETH.deployed()
    showBodyCyan("ANCHOR VIEW PRICE: ", await toNumber(await anchorViewOETH.currentValue()))

  })s
   */


})







describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 "
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate

  let proposal: number

  let out: any

  it("Makes the new proposal", async () => {

    await impersonateAccount(proposer)
    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    )

    const proposal = new ProposalContext("OETH")

    const addOracleOETH = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedWOETH.address,
        d.EthOracle
      )

    const listOETH = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedWOETH.address,
        s.OETH_LTV,
        s.CappedWOETH.address,
        s.OETH_LiqInc
      )

    const registerOETH_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.wOETH.address,
        s.CappedWOETH.address
      )

    //list OETH
    proposal.addStep(addOracleOETH, "setRelay(address,address)")
    proposal.addStep(listOETH, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerOETH_VVC, "registerUnderlying(address,address)")




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
      "List OETH",
      false
    )
    proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber())

    await gov.connect(prop).castVote(proposal, 1)

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())

    await gov.connect(prop).queue(proposal)

    await fastForward(timelock.toNumber())

    await gov.connect(prop).execute(proposal)


    await ceaseImpersonation(proposer)

  })
})

/**
 * Gas to deposit and wrap: 237282
 * Gas to deposit wrapped : 147613
 * ~90k to wrap
 * 
 * gas to withdraw without unwrap: 510084
 * initial gas to withdraw/unwrap: 583916
 * initial gas to redeem w/unwrap: 558074
 * ~47990 gas to unwrap
 */
describe("Check Wrapping", () => {

  it("Deposit and wrap", async () => {

    await s.OETH.connect(s.Carol).approve(s.CappedWOETH.address, s.OETH_AMOUNT)
    const gas = await getGas(await s.CappedWOETH.connect(s.Carol).deposit(s.OETH_AMOUNT, s.CaroLVaultID, true))
    showBodyCyan("Gas to deposit and wrap: ", gas)

    //verify
    const wbal = await s.wOETH.balanceOf(s.CarolVotingVault.address)
    const capBal = await s.CappedWOETH.balanceOf(s.CarolVault.address)

    expect(wbal).to.eq(capBal, "Cap tokens minted matches ending wOETH amount")

  })

  it("Withdraw", async () => {


    const gas = await getGas(
      await s.CarolVault.connect(s.Carol).withdrawErc20(
        s.CappedWOETH.address,
        await s.CappedWOETH.balanceOf(s.CarolVault.address))
    )
    showBodyCyan("Gas: ", gas)


    //verify
    //ending wOETH balance in vault should be 0
    let balance = await s.wOETH.balanceOf(s.CarolVotingVault.address)
    expect(balance).to.eq(0, "All wOETH removed")

    //ending total supply should be 0
    let ts = await s.CappedWOETH.totalSupply()
    expect(ts).to.eq(0, "Total supply returned to 0")

    //ending oeth balance of Carol should be OETH_AMOUNT +- some small amount? 
    balance = await s.OETH.balanceOf(s.Carol.address)
    expect(await toNumber(balance)).to.eq(await toNumber(s.OETH_AMOUNT), "All OETH returned")

  })


})