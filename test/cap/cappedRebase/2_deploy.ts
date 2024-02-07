import { s } from "../scope"
import { expect } from "chai"
import { toNumber } from "../../../util/math"
import { DeployNewProxyContract } from "../../../util/deploy"
import { oa, od } from "../../../util/addresser"
import { BN } from "../../../util/number"
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers"
import { ceaseImpersonation } from "../../../util/impersonator"
import { ethers } from "hardhat"
import { showBody } from "../../../util/format"
import { CappedRebaseToken__factory, IVault__factory, VotingVault__factory } from "../../../typechain-types"
import { setBalance } from "@nomicfoundation/hardhat-network-helpers"
import { mineBlock } from "../../../util/block"
import { providers } from "ethers"
require("chai").should()
describe("Check Interest Protocol contracts", () => {
  describe("Sanity check USDi deploy", () => {
    it("Should return the right name, symbol, and decimals", async () => {

      expect(await s.USDI.name()).to.equal("opUSDI Token")
      expect(await s.USDI.symbol()).to.equal("opUSDI")
      expect(await s.USDI.decimals()).to.equal(18)
      //expect(await s.USDI.owner()).to.equal(s.Frank.address)
      //s.owner = await s.USDI.owner()
    })
  })

  describe("Sanity check VaultController deploy", () => {
    it("Check data on VaultControler", async () => {
      let tokensRegistered = await s.VaultController.tokensRegistered()
      expect(tokensRegistered).to.be.gt(0)
      let interestFactor = await s.VaultController.interestFactor()
      expect(await toNumber(interestFactor)).to.be.gt(1)

    })
  })
})

describe("Deploy and register new capped rebase token", async () => {

  it("deploy", async () => {

    s.CappedOAUSDC = await DeployNewProxyContract(
      new CappedRebaseToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin.address,
      undefined,
      "Capped OP aUSDC",
      "caoUSDC",
      oa.aOptUsdcAddress,
      od.VaultController,
      od.VotingVaultController
    )
    await s.CappedOAUSDC.deployed()

  })

  it("Set Cap", async () => {
    await s.CappedOAUSDC.connect(s.Frank).setCap(s.aUSDCcap)
  })

  it("register", async () => {
    //fund owner contract with eth to do txs 
    const ownerAddr = await s.VotingVaultController.owner()
    await setBalance(ownerAddr, BN("1e18"))

    await impersonateAccount(ownerAddr)
    const owner = ethers.provider.getSigner(ownerAddr)
    await s.VotingVaultController.connect(owner).registerUnderlying(oa.aOptUsdcAddress, s.CappedOAUSDC.address)
    await s.Oracle.connect(owner).setRelay(s.CappedOAUSDC.address, od.UsdcRelay)
    await s.VaultController.connect(owner).registerErc20(
      s.CappedOAUSDC.address,
      BN("75e16"),
      s.CappedOAUSDC.address,
      BN("1e17")
    )
    await ceaseImpersonation(ownerAddr)
  })


  it("Mint vault from vault controller", async () => {
    //showBody("bob mint vault")
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
      .reverted
    await mineBlock()
    s.BobVaultID = await s.VaultController.vaultsMinted()
    let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
    s.BobVault = IVault__factory.connect(vaultAddress, s.Bob)
    expect(await s.BobVault.minter()).to.eq(s.Bob.address)

    //showBody("carol mint vault")
    await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
      .reverted
    await mineBlock()
    s.CaroLVaultID = await s.VaultController.vaultsMinted()
    vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
    s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol)
    expect(await s.CarolVault.minter()).to.eq(s.Carol.address)
  })

  it("Mint voting vault", async () => {

    let _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
    expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

    const result = await s.VotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
    await mineBlock()

    let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
    s.BobVotingVault = VotingVault__factory.connect(vaultAddr, s.Bob)

    expect(s.BobVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Bob's voting vault setup complete")
  })

  it("Mint a voting vault for a vault that you don't own", async () => {
    //Bob mints a vault using Carol's vault ID
    await s.VotingVaultController.connect(s.Bob).mintVault(s.CaroLVaultID)
    await mineBlock()

    let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.CaroLVaultID)
    s.CarolVotingVault = VotingVault__factory.connect(vaultAddr, s.Bob)

    expect(s.CarolVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Carol's voting vault setup complete")

    let info = await s.CarolVotingVault._vaultInfo()
    let vault = IVault__factory.connect(info.vault_address, s.Bob)
    let minter = await vault.minter()
    expect(minter.toUpperCase()).to.eq(s.Carol.address.toUpperCase())
  })
})

