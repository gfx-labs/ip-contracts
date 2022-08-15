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
    await impersonateAccount(s.owner._address)

    await impersonateAccount(s.owner._address)
    await s.Oracle.connect(s.owner).setRelay(s.CappedMatic.address, "0x8BFE7AE486250DBF2901843CC73B91843C2879DE")
    await mineBlock()
    await ceaseImpersonation(s.owner._address)

    let price = await s.Oracle.getLivePrice(s.CappedMatic.address)
    expect(await toNumber(price)).to.within(0.2,5, "Oracle is returning the correct price")

    await mineBlock()

    await ceaseImpersonation(s.owner._address)

  })

  it("Register Capped token on VaultController", async () => {

    await impersonateAccount(s.owner._address)

    await s.VaultController.connect(s.owner).registerErc20(
      s.CappedMatic.address,
      s.UNI_LTV,
      s.CappedMatic.address,
      s.LiquidationIncentive
    )
    await mineBlock()

    await ceaseImpersonation(s.owner._address)

  })

  it("Register Underlying on voting vault controller", async () => {

    await impersonateAccount(s.DEPLOYER._address)

    await s.VotingVaultController.connect(s.DEPLOYER).registerUnderlying(s.MATIC_ADDR, s.CappedMatic.address)
    await mineBlock()

    await ceaseImpersonation(s.DEPLOYER._address)

    const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.MATIC_ADDR)
    const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedMatic.address)

    expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedMatic.address.toUpperCase(), "Capped token registered correctly")
    expect(_CappedToken_underlying.toUpperCase()).to.eq(s.MATIC_ADDR.toUpperCase(), "Underlying token registered correctly")

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
    expect(await s.CappedMatic.getCap()).to.eq(BN("50000000e18"), "Original cap that was set")
    expect(await s.CappedMatic._underlying()).to.hexEqual(s.MATIC_ADDR)
  })
})
