import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { upgrades, ethers } from "hardhat";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import {
  AnchoredViewRelay,
  AnchoredViewRelay__factory,
  ChainlinkOracleRelay,
  ChainlinkOracleRelay__factory,
  CurveMaster,
  CurveMaster__factory,
  IERC20,
  IERC20__factory,
  IOracleRelay,
  OracleMaster,
  OracleMaster__factory,
  ProxyAdmin,
  ProxyAdmin__factory,
  TransparentUpgradeableProxy__factory,
  ThreeLines0_100,
  ThreeLines0_100__factory,
  UniswapV3OracleRelay__factory,
  USDI,
  USDI__factory,
  IVault__factory,
  VaultController,
  VaultController__factory,
  IVOTE,
  VotingVault__factory,
  UniswapV3TokenOracleRelay__factory,
  BogusOracle__factory,
  VotingVaultController__factory
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
require("chai").should();
describe("Check Interest Protocol contracts", () => {
  describe("Sanity check USDi deploy", () => {
    it("Should return the right name, symbol, and decimals", async () => {

      expect(await s.USDI.name()).to.equal("USDI Token");
      expect(await s.USDI.symbol()).to.equal("USDI");
      expect(await s.USDI.decimals()).to.equal(18);
      //expect(await s.USDI.owner()).to.equal(s.Frank.address);
      //s.owner = await s.USDI.owner()
      s.pauser = await s.USDI.pauser()
    });
  });

  describe("Sanity check VaultController deploy", () => {
    it("Check data on VaultControler", async () => {
      let tokensRegistered = await s.VaultController.tokensRegistered()
      expect(tokensRegistered).to.be.gt(0)
      let interestFactor = await s.VaultController.interestFactor()
      expect(await toNumber(interestFactor)).to.be.gt(1)

    });
  });
});

describe("Deploy cappedToken contract and infastructure", () => {

  const cap = utils.parseEther("100000")//100K 

  const ethAmount = BN("1e18")
  let tx = {
    to: s.owner._address,
    value: ethAmount
  }

  before(async () => {
    await s.Frank.sendTransaction(tx)
    await mineBlock()
  })

  it("Register on oracle master", async () => {

    const BogusRelay = await DeployContract(
      new BogusOracle__factory(s.Frank),
      s.Frank,
    )
    await mineBlock()
    let result = await BogusRelay.currentValue()
    expect(await toNumber(result)).to.eq(0.5, "Relay is returning the correct price")


    await impersonateAccount(s.owner._address)
    await s.Oracle.connect(s.owner).setRelay(s.cIPT.address, BogusRelay.address)
    await mineBlock()
    await ceaseImpersonation(s.owner._address)

    let price = await s.Oracle.getLivePrice(s.cIPT.address)
    expect(await toNumber(price)).to.eq(0.5, "Oracle is returning the correct price")


  })

 
   
  it("Register Capped token on VaultController", async () => {

    await impersonateAccount(s.owner._address)

    await s.VaultController.connect(s.owner).registerErc20(
      s.cIPT.address,
      s.UNI_LTV,
      s.cIPT.address,
      s.LiquidationIncentive
    )
    await mineBlock()

    await ceaseImpersonation(s.owner._address)

  })

  it("Register Underlying on voting vault controller", async () => {

    await impersonateAccount(s.DEPLOYER._address)

    await s.VotingVaultController.connect(s.DEPLOYER).registerUnderlying(s.IPT.address, s.cIPT.address)
    await mineBlock()

    await ceaseImpersonation(s.DEPLOYER._address)

    const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.IPT.address)
    const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.cIPT.address)

    expect(_underlying_CappedToken.toUpperCase()).to.eq(s.cIPT.address.toUpperCase(), "Capped token registered correctly")
    expect(_CappedToken_underlying.toUpperCase()).to.eq(s.IPT.address.toUpperCase(), "Underlying token registered correctly")

  })

  it("Mint vault from vault controller", async () => {
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

  it("Sanity check", async () => {
    expect(await s.cIPT.getCap()).to.eq(100, "Original cap that was set")
    expect(await (await s.cIPT._underlying()).toUpperCase()).to.eq(s.IPT.address.toUpperCase())
  })

  it("Set a higher cap for testing", async () => {

    await impersonateAccount(s.DEPLOYER._address)
    await s.cIPT.connect(s.DEPLOYER).setCap(BN("500e18").add(69))
    await mineBlock()
    await ceaseImpersonation(s.DEPLOYER._address)
    expect(await s.cIPT.getCap()).to.eq(BN("500e18").add(69), "New Cap Set")

  })




   
})