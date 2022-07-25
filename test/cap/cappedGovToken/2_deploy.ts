import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
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
  CappedGovToken__factory,
  VotingVaultController__factory
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
require("chai").should();
describe("Check Interest Protocol contracts", () => {
  describe("Sanity check USDi deploy", () => {
    it("Should return the right name, symbol, and decimals", async () => {

      expect(await s.USDI.name()).to.equal("USDI Token");
      expect(await s.USDI.symbol()).to.equal("USDI");
      expect(await s.USDI.decimals()).to.equal(18);
      //expect(await s.USDI.owner()).to.equal(s.Frank.address);
      s.owner = await s.USDI.owner()
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

  it("Deploy Voting Vault Controller", async () => {

    s.VotingVaultController = await DeployContractWithProxy(
      new VotingVaultController__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      s.VaultController.address
    )
    await mineBlock()
    await s.VotingVaultController.deployed()
    await mineBlock()
  })
  it("Deploy cappedToken", async () => {
    s.CappedAave = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedAave",
      "cAave",
      s.aaveAddress,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
  })

  it("Deploy new oracle system for Aave", async () => {

    //UniV3 Relay
    const uniV3AaveWETHfeed = "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"
    const UniRelay = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      60,
      uniV3AaveWETHfeed,
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()

    let result = await UniRelay.currentValue()
    //showBody("Result: ", await toNumber(result))

    //Chainlink relay
    const chainlinkAaveUSDfeed = "0x547a514d5e3769680ce22b2361c10ea13619e8a9"
    const LinkAaveRelay = await DeployContract(
      new ChainlinkOracleRelay__factory(s.Frank),
      s.Frank,
      chainlinkAaveUSDfeed,
      BN("1e10"),
      BN("1")
    )
    await mineBlock()
    result = await LinkAaveRelay.currentValue()
    //showBody("Result: ", await toNumber(result))

    s.AnchoredViewAave = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      UniRelay.address,
      LinkAaveRelay.address,
      BN("10"),
      BN("100")
    )
    await mineBlock()
    result = await s.AnchoredViewAave.currentValue()
    expect(result).to.not.eq(0, "Oracle is returning a price")
    //showBody("Result: ", await toNumber(result))


  })

  it("Register Underlying on voting vault controller", async () => {

    await s.VotingVaultController.connect(s.Frank).registerUnderlying(s.aaveAddress, s.CappedAave.address)
    await mineBlock()

    const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.aaveAddress)
    const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedAave.address)

    expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedAave.address.toUpperCase(), "Capped token registered correctly")
    expect(_CappedToken_underlying.toUpperCase()).to.eq(s.AAVE.address.toUpperCase(), "Underlying token registered correctly")

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

    const result = await s.VotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
    await mineBlock()

    let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
    s.BobVotingVault = VotingVault__factory.connect(vaultAddr, s.Bob)

    expect(s.BobVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Bob's voting vault setup complete")
  })

  it("Mint a voting vault for a vault that you don't own", async () => {
    await s.VotingVaultController.connect(s.Bob).mintVault(s.CaroLVaultID)
    await mineBlock()

    let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.CaroLVaultID)
    s.CarolVotingVault = VotingVault__factory.connect(vaultAddr, s.Bob)

    expect(s.CarolVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Carol's voting vault setup complete")
  })

  it("Set Cap", async () => {
    await s.CappedAave.connect(s.Frank).setCap(s.AaveCap)//100K USDC
    await mineBlock()
  })

  it("Sanity check", async () => {
    expect(await s.CappedAave.getCap()).to.eq(s.AaveCap)
    expect(await (await s.CappedAave._underlying()).toUpperCase()).to.eq(s.AAVE.address.toUpperCase())
  })
})