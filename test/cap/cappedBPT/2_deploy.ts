import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { upgrades, ethers } from "hardhat";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear, hardhat_mine } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import {
  AnchoredViewRelay__factory,
  BalancerStablePoolTokenOracle__factory,
  BPT_TWAP_Oracle__factory,
  BPT_WEIGHTED_ORACLE__factory,
  CappedBptToken__factory,
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

    it("Mint vault for Carol", async () => {
      await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
        .reverted;
      await mineBlock();
      s.CaroLVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
      s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
      expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
    })
  });
});


describe("Upgrade Voting Vault Controller", () => {

  it("Deploy new implementation", async () => {
    const bptControllerFactory = await ethers.getContractFactory("VotingVaultController")
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

  it("Mint BPT vaults", async () => {
    await s.VotingVaultController.connect(s.Bob).mintBptVault(s.BobVaultID)
    await mineBlock()
    s.BobBptVault = VaultBPT__factory.connect(await s.VotingVaultController.BPTvaultAddress(s.BobVaultID), s.Bob)

    let info = await s.BobBptVault._vaultInfo()
    expect(info.id).to.eq(s.BobVaultID, "ID is correct, vault minted successfully")

    await s.VotingVaultController.connect(s.Carol).mintBptVault(s.CaroLVaultID)
    await mineBlock()
    s.CarolBptVault = VaultBPT__factory.connect(await s.VotingVaultController.BPTvaultAddress(s.CaroLVaultID), s.Carol)

    info = await s.CarolBptVault._vaultInfo()
    expect(info.id).to.eq(s.CaroLVaultID, "ID is correct, vault minted successfully")
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

  /**
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

    await s.CappedStethBpt.connect(s.Bob).deposit(depositAmount, s.BobVaultID, false)
    await mineBlock()

  })
   


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

    await s.CappedStethBpt.connect(s.Bob).deposit(depositAmount, s.BobVaultID, false)
    await mineBlock()
  })
  */
})

describe("Check BPT vault functions", () => {


  it("collect rewards", async () => {

    //await s.BobBptVault.connect(s.Bob).claimRewards(s.Bob.address, s.stETH_Gauge.address)
    //todo verify

  })
  /**
   * Deposit into 80/20 BAL/wETH to get BPT and receive auraBal
   * stake auraBAL and receive BAL, bb-a-usd, AURA
   * 
   * Deposit eth for BPT - https://etherscan.io/tx/0xc13ca913667f10ccf787cf6f626ccd0b2c6f921e6ca8608be361aadae3776c14
   * joinPool(bytes32, address, address, (address[],uint256[],bytes,bool)) (balancer vault 0xba12222222228d8ba445958a75a0704d566bf2c8)
      1	poolId	bytes32	0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014
      2	sender	address	0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89
      3	recipient	address	0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89
      3	request.assets	address	0xba100000625a3754423978a60c9317c58a424e3D,0x0000000000000000000000000000000000000000


   * Mint and stake - https://etherscan.io/tx/0x8c2e8db7a1daabd8eba83d7669c283a314a18af861974ae7c7cb59248794e466
   * deposit(uint256 _amount, bool _lock, address _stakeAddress)(crvDepositer 0xeAd792B55340Aa20181A80d6a16db6A0ECd1b827)
      0	_amount	uint256	1010917644170912739
      1	_lock	bool	true
      2	_stakeAddress	address	0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2

   * OR can also contribute to auraBAL / 80/20 BAL/wETH BPT
      joinPool()
   * Stake this BPT on aura to receive AURA
   * 
   */
  it("Aura functions", async () => {
    const depositWrapperAddr = "0x68655ad9852a99c87c0934c7290bb62cfa5d4123"
    const rewardsAddr = "0x00a7ba8ae7bca0b10a32ea1f8e2a1da980c6cad2"
    const crvDepositerAddr = "0xeAd792B55340Aa20181A80d6a16db6A0ECd1b827"
    const auraBalAddr = "0x616e8bfa43f920657b3497dbf40d6b1a02d4608d"
    const BalAddr = "0xba100000625a3754423978a60c9317c58a424e3d"
    //todo
  })

})

describe("Setup oracles, deploy and register cap tokens", () => {

  let wstethRelay: IOracleRelay
  let stEThMetaStablePoolOracle: IOracleRelay
  let weightedPoolOracle: IOracleRelay

  let auraUniRelay: IOracleRelay
  let auraBalRelay: IOracleRelay
  let auraBalAnchorView: IOracleRelay
  let auraStablePoolLPoracle: IOracleRelay
  let primeBPToracle: IOracleRelay

  const BAL_TOKEN_ORACLE = "0xf5E0e2827F60580304522E2C38177DFeC7a428a4"

  const primeBPT = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56"

  it("Check wstETH exchange rate relay", async () => {

    wstethRelay = await new WstETHRelay__factory(s.Frank).deploy()
    await mineBlock()
    //showBody("wstETH direct conversion price: ", await toNumber(await wstethRelay.currentValue()))

  })


  ///this oracle gets the simple pool balances from the balancer vault, and then divides against the total supply of BPTs
  it("Deploy and check meta stable pool oracle", async () => {


    //wstETH/weth MetaStable pool
    stEThMetaStablePoolOracle = await new BPT_Oracle__factory(s.Frank).deploy(
      "0x32296969Ef14EB0c6d29669C550D4a0449130230", //pool_address
      ["0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [wstethRelay.address, s.wethOracleAddr], //_oracles
      BN("1"),
      BN("100")
    )
    await mineBlock()

    //showBodyCyan("BPT value: ", await toNumber(await (await stEThMetaStablePoolOracle.currentValue())))
    expect(await toNumber(await stEThMetaStablePoolOracle.currentValue())).to.be.closeTo(1716, 1, "Oracle price within 1% of simple price")

  })

  it("Try meta stable pool oracle again", async () => {

    const rETH_WETH_BPT = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
    const rETH = "0xae78736Cd615f374D3085123A210448E74Fc6393"
    const cappedRETH = "0x64eA012919FD9e53bDcCDc0Fc89201F484731f41"
    const rETH_Oracle = "0x69F3d75Fa1eaA2a46005D566Ec784FE9059bb04B"

    const testStableOracle = await new BPT_Oracle__factory(s.Frank).deploy(
      rETH_WETH_BPT, //pool_address
      [rETH, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [rETH_Oracle, s.wethOracleAddr], //_oracles, weth oracle
      BN("1"),
      BN("100")
    )
    await mineBlock()

    //showBodyCyan("rETH BPT value: ", await toNumber(await (await testStableOracle.currentValue())))
    expect(await toNumber(await testStableOracle.currentValue())).to.be.closeTo(1709, 1, "Oracle price within 1% of simple price")

  })

  it("Check weighted oracle", async () => {
    const balWethBPT = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56" //bal80 / weth20
    const CappedBalancer = "0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85"
    const balancerToken = "0xba100000625a3754423978a60c9317c58a424e3D"

    weightedPoolOracle = await new BPT_WEIGHTED_ORACLE__factory(s.Frank).deploy(
      balWethBPT,
      [balancerToken, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [BAL_TOKEN_ORACLE, s.wethOracleAddr], //_oracles, weth oracle
      BN("1"),
      BN("100")
    )
    await weightedPoolOracle.deployed()
    //showBodyCyan("BalWeth BPT value: ", await toNumber(await weightedPoolOracle.currentValue()))
    expect(await toNumber(await weightedPoolOracle.currentValue())).to.be.closeTo(17, 1, "Oracle price within 1% of simple price")

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
    expect(await toNumber(await uniAuraRelay.currentValue())).to.be.closeTo(2.65, 0.1, "Aura relay price is correct")

    const testStableOracle = await new BPT_WEIGHTED_ORACLE__factory(s.Frank).deploy(
      wethAuraBPT, //pool_address
      [auraToken, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [uniAuraRelay.address, s.wethOracleAddr], //_oracles, weth oracle
      BN("1"),
      BN("100")
    )
    await mineBlock()

    expect(await toNumber(await testStableOracle.currentValue())).to.be.closeTo(70, 5, "Oracle price within 1% of simple price")
  })

  /**
   * Uni v3 relay
   * Balancer relay, new Balancer weighted pool relay??
   * Current price ~$17
   * aura token = 0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF
   * auraBal = 0x616e8BfA43F920657B3497DBf40D6b1A02D4608d
   * 
   */
  it("auraBal oracle", async () => {
    const uniPool = "0xFdeA35445489e608fb4F20B6E94CCFEa8353Eabd"//3k, meh liquidity

    auraUniRelay = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
      500,
      uniPool,
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await auraUniRelay.deployed()

    showBodyCyan("AuraBal uni relay price: ", await toNumber(await auraUniRelay.currentValue()))



    //aura relay using balancer
    const balancerPool = "0x3dd0843A028C86e0b760b1A76929d1C5Ef93a2dd" //auraBal/"veBal" BPT stable pool (B-80BAL-20WETH - 0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56)

    primeBPToracle = await new BPT_WEIGHTED_ORACLE__factory(s.Frank).deploy(
      primeBPT,
      [s.BAL.address, s.wethAddress],
      [BAL_TOKEN_ORACLE, s.wethOracleAddr],
      BN("10"),
      BN("100")
    )

    await primeBPToracle.deployed()
    //showBody("Prime BPT oracle price: ", await toNumber(await primeBPToracle.currentValue()))
    auraBalRelay = await new BalancerStablePoolTokenOracle__factory(s.Frank).deploy(
      balancerPool,
      primeBPT,
      primeBPToracle.address
    )
    await auraBalRelay.deployed()
    showBodyCyan("AuraBal invariant relay price: ", await toNumber(await auraBalRelay.currentValue()))

    //anchorView
    auraBalAnchorView = await new AnchoredViewRelay__factory(s.Frank).deploy(
      auraUniRelay.address,
      auraBalRelay.address,
      BN("10"),
      BN("100")
    )
    await auraBalAnchorView.deployed()
    showBodyCyan("AuraBal anchor view result: ", await toNumber(await auraBalAnchorView.currentValue()))

  })

  /**
   * Set up oracle for stable pool 'prime' BPT / auraBal LP token 0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd
   * This is the oracle used for the price of the reward token being listed
   */
  it("Aura LP token oracle", async () => {
    auraStablePoolLPoracle = await new BPT_Oracle__factory(s.Frank).deploy(
      s.primeAuraBalLP.address,
      [primeBPT, s.auraBal.address],//prime BPT / auraBal
      [primeBPToracle.address, auraBalAnchorView.address],//prime BPT oracle / auraBal oracle
      BN("1"),
      BN("100")
    )
    await auraStablePoolLPoracle.deployed()
    showBodyCyan("Price for primeBPT / auraBal Aura Stable pool LP: ", await toNumber(await auraStablePoolLPoracle.currentValue()))
  })

  it("Deploy and Register gaugeToken", async () => {
    s.CappedStethGauge = await DeployContractWithProxy(
      new CappedBptToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedStethGauge",
      "cstEthGauge",
      s.stETH_Gauge.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedStethGauge.deployed()
    await s.CappedStethGauge.setCap(s.STETH_CAP)
    await s.CappedStethGauge.connect(s.Frank).transferOwnership(s.owner._address)

    await impersonateAccount(s.owner._address)
    //register on voting vault controller
    await s.VotingVaultController.connect(s.owner).registerUnderlying(s.stETH_Gauge.address, s.CappedStethGauge.address)

    //register oracle
    await s.Oracle.connect(s.owner).setRelay(s.CappedStethGauge.address, stEThMetaStablePoolOracle.address)
    showBody("Live Price: ", await toNumber(await s.Oracle.getLivePrice(s.CappedStethGauge.address)))

    //register on vault controller
    await s.VaultController.connect(s.owner).registerErc20(
      s.CappedStethGauge.address,
      s.auraBalLTV,
      s.CappedStethGauge.address,
      s.LiquidationIncentive
    )
    await ceaseImpersonation(s.owner._address)
  })


  it("Deploy and Register CappedAuraBal", async () => {
    s.CappedAuraBal = await DeployContractWithProxy(
      new CappedBptToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedAuraBal",
      "cAuraBal",
      s.auraBal.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedAuraBal.deployed()
    await s.CappedAuraBal.setCap(s.AuraBalCap)
    await s.CappedAuraBal.connect(s.Frank).transferOwnership(s.owner._address)

    await impersonateAccount(s.owner._address)
    //register on voting vault controller
    await s.VotingVaultController.connect(s.owner).registerUnderlying(s.auraBal.address, s.CappedAuraBal.address)

    //register oracle
    await s.Oracle.connect(s.owner).setRelay(s.CappedAuraBal.address, auraBalAnchorView.address)
    showBody("Live Price: ", await toNumber(await s.Oracle.getLivePrice(s.CappedAuraBal.address)))

    //register on vault controller
    await s.VaultController.connect(s.owner).registerErc20(
      s.CappedAuraBal.address,
      s.auraBalLTV,
      s.CappedAuraBal.address,
      s.LiquidationIncentive
    )
    await ceaseImpersonation(s.owner._address)

  })

  it("Deploy and register Capped Aura LP token", async () => {
    s.CappedAuraLP = await DeployContractWithProxy(
      new CappedBptToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedAuraLP",
      "caLP",
      s.primeAuraBalLP.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedAuraLP.deployed()
    await s.CappedAuraLP.setCap(s.AuraLPamount)

    await s.CappedAuraLP.connect(s.Frank).transferOwnership(s.owner._address)

    await impersonateAccount(s.owner._address)
    //register on voting vault controller
    await s.VotingVaultController.connect(s.owner).registerUnderlying(s.primeAuraBalLP.address, s.CappedAuraLP.address)

    //register oracle
    await s.Oracle.connect(s.owner).setRelay(s.CappedAuraLP.address, auraStablePoolLPoracle.address)
    showBody("Live Price: ", await toNumber(await s.Oracle.getLivePrice(s.CappedAuraLP.address)))

    //register on vault controller
    await s.VaultController.connect(s.owner).registerErc20(
      s.CappedAuraLP.address,
      s.auraBalLTV,
      s.CappedAuraLP.address,
      s.LiquidationIncentive
    )
    await ceaseImpersonation(s.owner._address)
  })

  /**
   * Aura LP token notes
   * Rewards contract - 0xacada51c320947e7ed1a0d0f6b939b0ff465e4c2 //LIST THIS
   * Rewards Depositer - 0xb188b1cb84fb0ba13cb9ee1292769f903a9fec59
   * LP token - 0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd // staked 1:1 for rewards token
   * 
   * LP tokens are approving aura Booster 0xA57b8d98dAE62B26Ec3bcC4a365338157060B234 and calling deposit https://etherscan.io/tx/0x63174bb01aa1e9bb9c9642670026b1d324a33d40d4ce60557f3f09e29cdb6f30
   * Receive Base rewards Pool 0xACAdA51C320947E7ed1a0D0F6b939b0FF465E4c2 which has a good distribution
   * 
   * All LP holders stake to Balancer B-auraBAL-STABLE Gauge Deposit 0x0312AA8D0BA4a1969Fddb382235870bF55f7f242
   * All gauge token holders stake to aura VoterProxy 0xaF52695E1bB01A16D33D7194C28C42b10e0Dbec2
   * 
   * Call deposit single on rewards contract? to receive rewards token 0xACAdA51C320947E7ed1a0D0F6b939b0FF465E4c2
   * 
   * Deposit naitive assets to get aura LP token
   * Stake LP token
   */
  /**
   * not transferrable? 
   it("Deploy and register Capped Aura LP reward token", async () => {
    s.CappedAuraLP = await DeployContractWithProxy(
      new CappedBptToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedAuraLPrewardToken",
      "cALPR",
      s.primeAuraBalRewardToken.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedAuraLP.deployed()
    await s.CappedAuraLP.setCap(s.AuraBalCap)

    await s.CappedAuraLP.connect(s.Frank).transferOwnership(s.owner._address)

    await impersonateAccount(s.owner._address)
    //register on voting vault controller
    await s.VotingVaultController.connect(s.owner).registerUnderlying(s.primeAuraBalRewardToken.address, s.CappedAuraLP.address)

    //register oracle
    await s.Oracle.connect(s.owner).setRelay(s.CappedAuraLP.address, auraStablePoolLPoracle.address)
    showBody("Live Price: ", await toNumber(await s.Oracle.getLivePrice(s.CappedAuraLP.address)))

    //register on vault controller
    await s.VaultController.connect(s.owner).registerErc20(
      s.CappedAuraLP.address,
      s.auraBalLTV,
      s.CappedAuraLP.address,
      s.LiquidationIncentive
    )
    await ceaseImpersonation(s.owner._address)

  })
   */

  /**
    * AuraBal BaseRewardsPool - 0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2
    * Etherscan can't format 0 decimals 1.013404652797941235 auraBal => 1,013,404,652,797,940,000 rewards tokens 
    * Rewards paid in positive rebase on withdraw? AuraBal received     1,013,404,652,797,941,235
    * https://etherscan.io/tx/0x4e15607b6cf9f0acd7374f825074ab492c99ebca65ac86f802641d3aaefe69e1
    */
  /**
   * Rewards token not liquid :(
   it("Register CappedAuraBalRewards token", async () => {

    s.CappedAuraBalRewards = await DeployContractWithProxy(
      new CappedBptToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedAuraBalRewards",
      "cAuraBalRewards",
      s.auraBalRewards.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedAuraBalRewards.deployed()
    await s.CappedAuraBalRewards.connect(s.Frank).transferOwnership(s.owner._address)

    await impersonateAccount(s.owner._address)
    //register on voting vault controller
    await s.VotingVaultController.connect(s.owner).registerUnderlying(s.auraBalRewards.address, s.CappedAuraBalRewards.address)

    //No need to register oracle, same oracle as CappedAuraBal


    //register on vault controller
    await s.VaultController.connect(s.owner).registerErc20(
      s.CappedAuraBalRewards.address,
      s.auraBalLTV,
      s.CappedAuraBal.address,//same oracle as CappedAuraBal
      s.LiquidationIncentive
    )
    await ceaseImpersonation(s.owner._address)

  })
   */
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