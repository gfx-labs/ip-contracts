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
  BalancerWeightedPoolRelay__factory,
  BPT_TWAP_Oracle__factory,
  BPT_WEIGHTED_ORACLE__factory,
  IOracleRelay,
  IVault__factory,
  UniswapV3TokenOracleRelay__factory,
  VaultBPT__factory,
  WstETHRelay__factory,
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
import { BPT_Oracle__factory } from "../../../typechain-types/factories/oracle/External/BPT_Oracle.sol/BPT_Oracle__factory";



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
    //todo verify

  })

  it("Aura functions", async () => {
    //todo
  })
})

describe("Oracle things", () => {

  let oracle: IOracleRelay
  let wstethRelay: IOracleRelay
  let stablePoolOracle: IOracleRelay
  let weightedPoolOracle: IOracleRelay

  /**
   * testing with reth 
   * need reth / eth balancer pool and gauge
   * 
   * 
   */

  it("Check wstETH exchange rate relay", async () => {

    wstethRelay = await new WstETHRelay__factory(s.Frank).deploy()
    await mineBlock()
    //showBody("wstETH price: ", await toNumber(await wstethRelay.currentValue()))

  })


  ///this oracle gets the simple pool balances from the balancer vault, and then divides against the total supply of BPTs
  it("Deploy and check stable pool oracle", async () => {


    stablePoolOracle = await new BPT_Oracle__factory(s.Frank).deploy(
      "0x32296969Ef14EB0c6d29669C550D4a0449130230", //pool_address
      ["0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [wstethRelay.address, "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"], //_oracles
      BN("1"),
      BN("100")
    )
    await mineBlock()

    //showBodyCyan("BPT value: ", await toNumber(await (await stablePoolOracle.currentValue())))
    expect(await toNumber(await stablePoolOracle.currentValue())).to.be.closeTo( 1615, 1, "Oracle price within 1% of simple price")

  })

  it("Try stable pool oracle again", async () => {

    const rETH_WETH_BPT = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
    const rETH = "0xae78736Cd615f374D3085123A210448E74Fc6393"
    const cappedRETH = "0x64eA012919FD9e53bDcCDc0Fc89201F484731f41"
    const rETH_Oracle = "0x69F3d75Fa1eaA2a46005D566Ec784FE9059bb04B"

    const testStableOracle = await new BPT_Oracle__factory(s.Frank).deploy(
      rETH_WETH_BPT, //pool_address
      [rETH, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [rETH_Oracle, "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"], //_oracles, weth oracle
      BN("1"),
      BN("100")
    )
    await mineBlock()

    //showBodyCyan("rETH BPT value: ", await toNumber(await (await testStableOracle.currentValue())))
    expect(await toNumber(await testStableOracle.currentValue())).to.be.closeTo( 1611, 1, "Oracle price within 1% of simple price")

  })

  it("Check weighted oracle", async () => {
    const balWethBPT = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56" //bal80 / weth20
    const CappedBalancer = "0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85"
    const balancerToken = "0xba100000625a3754423978a60c9317c58a424e3D"
    const balancerOracle = "0xf5E0e2827F60580304522E2C38177DFeC7a428a4"

    weightedPoolOracle = await new BPT_WEIGHTED_ORACLE__factory(s.Frank).deploy(
      balWethBPT,
      [balancerToken, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [balancerOracle, "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"], //_oracles, weth oracle
      BN("1"),
      BN("100")
    )
    await weightedPoolOracle.deployed()
    //showBodyCyan("BalWeth BPT value: ", await toNumber(await weightedPoolOracle.currentValue()))
    expect(await toNumber(await weightedPoolOracle.currentValue())).to.be.closeTo(16, 1, "Oracle price within 1% of simple price")

  })

  it("Deploy and check weighted pool oracle again", async () => {
    const wethAuraBPT = "0xCfCA23cA9CA720B6E98E3Eb9B6aa0fFC4a5C08B9" //weth / aura 50/50
    const auraToken = "0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF"
    const auraPoolAddr3k = "0x4Be410e2fF6a5F1718ADA572AFA9E8D26537242b"

    const uniAuraRelay = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
      500,
      auraPoolAddr3k,
      true,
      BN("1"),
      BN("1")
    )
    await uniAuraRelay.deployed()
    expect(await toNumber(await uniAuraRelay.currentValue())).to.be.closeTo(2.2, 0.1, "Aura relay price is correct")

    const testStableOracle = await new BPT_WEIGHTED_ORACLE__factory(s.Frank).deploy(
      wethAuraBPT, //pool_address
      [auraToken, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [uniAuraRelay.address, "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"], //_oracles, weth oracle
      BN("1"),
      BN("100")
    )
    await mineBlock()

    expect(await toNumber(await testStableOracle.currentValue())).to.be.closeTo(62, 5, "Oracle price within 1% of simple price")
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