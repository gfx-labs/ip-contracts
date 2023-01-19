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
  IOracleRelay,
  IVault__factory,
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

describe("Check BPT vault functions", () => {


  it("collect rewards", async () => {

    await s.BobBptVault.connect(s.Bob).claimRewards(s.Bob.address, s.stETH_Gauge.address)

  })

  it("Aura functions", async () => {

  })


})

describe("Oracle things", () => {

  let oracle: IOracleRelay
  let invariantOracle: IOracleRelay

  /**
   * testing with reth 
   * need reth / eth balancer pool and gauge
   * 
   * 
   */


  ///this oracle gets the simple pool balances from the balancer vault, and then divides against the total supply of BPTs
  it("Deploy and check invariant oracle", async () => {

    /**
     * General procedure
     * Array of tokens that are in balancer pool
     * Equal length array of oracles for each asset
     * 
     * Get balance => value for each asset in the pool to gather a total asset value
     * divide by BPT total supply 
     */




  })


  it("Deploy and check TWAP oracle", async () => {

    const factory = await ethers.getContractFactory("BPT_TWAP_Oracle")

    oracle = await factory.deploy(
      14400,
      "0x32296969Ef14EB0c6d29669C550D4a0449130230",
      "0x72D07D7DcA67b8A406aD1Ec34ce969c90bFEE768",
      1,
      1
    )
    await mineBlock()
    await oracle.deployed()

    const result = await oracle.currentValue()
    showBodyCyan("RESULT: ", await toNumber(result))

  })




  /**
   * calculate from invariant
   * we need the underlying price of token 1
   * and the price of token 1 in terms of token 2 - TWAP ? 
   * 
   *  _ 
   * | | symbol is prod - product
   */

  it("oracle math", async () => {
    const amp = BN("50000")

    const invariant = BN("116541847842842509280324").mul(amp)
    const totalSupply = BN("113210279768128923680919")

    showBody("Result: ", invariant.div(totalSupply))
    showBody("Format: ", await toNumber(invariant.div(totalSupply)))
    showBody("New format: ", await toNumber(invariant) / await toNumber(totalSupply))

  })

})




/**
 * oracle notes
 * see tx https://etherscan.io/tx/0x2dd37029541174bd7c07a5cd9ac0c72bb04a45835f2c3841ce5d003c69c3a786
 * input 0.01 eth ==>> 0.000428598049387651 BPT (Balancer stETH stable pool)
 * 
 * https://etherscan.io/tx/0x8f323620a727394f86d3762b1a726257ea0fa0aadbaaef55bda0c7adf2a0b643
 * stake 1:1 for gauge tokens
 * 
 * https://etherscan.io/tx/0x96ef901dc91ed2576516f29c74d7bdd94a9d675a6f5dc603e7dce6370d3723a7
 * unstake - 1:1 gauge => bpt
 * 
 * EXIT POOL - function on balancer vault? 
 * 
 * https://etherscan.io/tx/0xf17c8409773211c02398ccdca3fca94d184940500c4a3d612c72f94d6f0d66d1
 * withdraw both pool tokens
 * burn 0.004841415705915759 BPT for:
 * 0.002518751088880166 wstETH
 * 0.00219997391912264 wETH
 * 
 * https://etherscan.io/tx/0x76f4ae2bdc238c8aa270edb071062f4bf068d985759cf66d60687ac1d1291844
 * withdraw eth only
 * burn 0.004939222083813048 BPT for:
 * 0.005070746914439014 eth (~7.98 USD) 7.98 / 0.0050707... == 1573.7326585951272779952791570015 - accurate price for this block
 * so BPT price should be 7.98 / 0.00593922... == 1,615.639062184287 USD
 * 
 * Meta stable pools have a twap for the BPT I think, this is the twap for 1 assset to the other in the pool
 * to convert this to the BPT price, we need to call
 * 
 */