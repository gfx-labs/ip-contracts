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
  CappedGovToken__factory,
  VotingVaultController__factory,
  VaultBPT__factory
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
import { BPT_VaultController__factory } from "../../../typechain-types/factories/lending/BPT_VaultController__factory";
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

    it("Mint vault for Bob", async () => {
      await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
        .reverted;
      await mineBlock();
      s.BobVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
      s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
      expect(await s.BobVault.minter()).to.eq(s.Bob.address);
    })
  });
});


describe("Upgrade Voting Vault Controller", () => {

  it("Deploy new implementation", async () => {
    const bptControllerFactory = await ethers.getContractFactory("BPT_VaultController")
    const implementation = await bptControllerFactory.deploy()
    await mineBlock()
    await implementation.deployed()

    const tx = {
      to: s.owner._address,
      value: BN("1e18")
    }
    await s.Frank.sendTransaction(tx)
    await mineBlock()

    //upgrade
    await impersonateAccount(s.owner._address)
    await s.ProxyAdmin.connect(s.owner).upgrade(s.VotingVaultController.address, implementation.address)
    await mineBlock()
    await ceaseImpersonation(s.owner._address)

    expect(await s.VotingVaultController._vaultController()).to.eq(s.VaultController.address, "Upgrade successful")

  })

  it("Mint a BPT vault", async () => {
    await s.VotingVaultController.connect(s.Bob).mintBptVault(s.BobVaultID)
    await mineBlock()
    s.BobBptVault = VaultBPT__factory.connect(await s.VotingVaultController.BPTvaultAddress(s.BobVaultID), s.Bob)

    const info = await s.BobBptVault._vaultInfo()
    expect(info.id).to.eq(s.BobVaultID, "ID is correct, vault minted successfully")
  })

})

/**
 * Steal Gauges 
 * Deposit
 * Register cap token on VC
 * Stake Gauges on aura? Can stake BPTs for BPT rewards as well as aura rewards
 * Or just list staked Aura BPTs? 
 * --ORACLE PROBLEM
 * Check voting power
 * Check deposit/withdraw staking functions
 */

describe("Deploy and fund capped bpt", async () => {

  const depositAmount = BN("100e18")

  it("Deploy capped gauge contract", async () => {
    const factory = await ethers.getContractFactory("CappedBptToken")
    s.CappedStethBpt = await factory.deploy()
    await mineBlock()

    await s.CappedStethBpt.initialize(
      "Capped B-stETH-STABLE-gauge",
      "cstETH_STABLE_GAUGE",
      "0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE",//gauge
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()

    await s.CappedStethBpt.setCap(s.CappedGaugeCap)
    await mineBlock()
  })

  it("Register gauge token", async () => {
    await impersonateAccount(s.GOV._address)
    await s.VotingVaultController.connect(s.GOV).registerUnderlying(s.stETH_Gauge.address, s.CappedStethBpt.address)
    await mineBlock()
    await ceaseImpersonation(s.GOV._address)
  })

  it("Deposit stETH/ETH BPT", async () => {

    await s.stETH_Gauge.connect(s.Bob).approve(s.CappedStethBpt.address, depositAmount)
    await mineBlock()

    await s.CappedStethBpt.connect(s.Bob).deposit(depositAmount, s.BobVaultID)
    await mineBlock()

  })

  /**
   * BPT Vault should receive underlying, gauge token in this case
   * Standard vault receives cap tokens
   */
  it("Check destinations", async () => {

    let balance = await s.CappedStethBpt.balanceOf(s.BobVault.address)
    expect(balance).to.eq(depositAmount, "Cap tokens minted to standard vault")

    balance = await s.stETH_Gauge.balanceOf(s.BobBptVault.address)
    expect(balance).to.eq(depositAmount, "Underlying sent to BPT vault")
  })

  it("Check withdraw", async () => {

    const startBal = await s.stETH_Gauge.balanceOf(s.Bob.address)

    await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedStethBpt.address, depositAmount)
    await mineBlock()

    let balance = await s.stETH_Gauge.balanceOf(s.Bob.address)
    expect(balance.sub(startBal)).to.eq(depositAmount, "Received the correct amount in the withdraw")

  })

  it("Deposit again for future tests", async () => {
    await s.stETH_Gauge.connect(s.Bob).approve(s.CappedStethBpt.address, depositAmount)
    await mineBlock()

    await s.CappedStethBpt.connect(s.Bob).deposit(depositAmount, s.BobVaultID)
    await mineBlock()
  })
})

