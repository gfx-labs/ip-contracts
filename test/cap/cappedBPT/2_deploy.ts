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
import { toNumber, getGas } from "../../../util/math"
import { stealMoney } from "../../../util/money";

import {
  AnchoredViewRelay__factory,
  BalancerStablePoolTokenOracle__factory,
  BPT_WEIGHTED_ORACLE__factory,
  CappedBptToken__factory,
  IOracleRelay,
  IVault__factory,
  UniswapV3TokenOracleRelay__factory,
  VaultBPT__factory,
  WstETHRelay__factory,
  StablePoolOracle,
  RateProofOfConcept__factory,
  IOracleRelay__factory,
  BPTstablePoolOracle__factory
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

      const result = await s.VaultController.connect(s.Carol).mintVault()
      const gas = await getGas(result)
      showBodyCyan("Gas to mint standard vault: ", gas)

      s.CaroLVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
      s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
      expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
    })

    it("Mint voting vault for Carol", async () => {
      const result = await s.VotingVaultController.mintVault(s.CaroLVaultID)
      const gas = await getGas(result)
      showBodyCyan("Gas to mint standard voting vault: ", gas)
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
    //register auraBal
    await s.VotingVaultController.connect(s.owner).registerAuraBal(s.auraBal.address)
    await ceaseImpersonation(s.owner._address)

    expect(await s.VotingVaultController._vaultController()).to.eq(s.VaultController.address, "Upgrade successful")



  })

  it("Mint BPT vaults", async () => {
    const result = await s.VotingVaultController.connect(s.Bob).mintBptVault(s.BobVaultID)
    const gas = await getGas(result)
    showBodyCyan("Cas to mint BPT vault: ", gas)

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



  /**
Notes regarding error in price calculation utilizing Revest formula

Closest to simple: K 
invariant onl  1807445808749031612880 1807.44580874903161288
INV utilize K  1807427734290944122563 1807.427734290944122563
Robust price:  1716542781054602544033 1716.542781054602544033
simple price:  1716542740177402721733 1716.542740177402721733
Deviation from simple price: 5.294653723806986%

Closest to simple: K 
invariant onl  1759991645857842864514 1759.991645857842864514
INV utilize K  1759974045941384286086 1759.974045941384286086
Robust price:  1709353293223869510514 1709.353293223869510514
simple price:  1709351161866984898973 1709.351161866984898973
Deviation from simple price: 2.961526291596399%

Closest to simple: INV
invariant onl  18291087272096805490   18.29108727209680549
INV utilize K  18290904361224084522   18.290904361224084522
Robust price:  18326395901812910110   18.326395901812910110
simple price:  18326395901725071798   18.326395901725071798
Deviation from simple price: -0.19266543%

*/
  //  BPT_Oracle calculates the spot price of one token in terms of the other using this formula
  //  This is similar to how the Balancer pools calculate the spot price utilizing the invariant and amp
  //
  //
  //                             2.a.x.y + a.y^2 + b.y                                                         //
  // spot price Y/X = - dx/dy = -----------------------                                                        //
  //                             2.a.x.y + a.x^2 + b.x                                                         //
  //                                                                                                           //
  // n = 2                                                                                                     //
  // a = amp param * n                                                                                         //
  // b = D + a.(S - D)                                                                                         //
  // D = invariant                                                                                             //
  // S = sum of balances but x,y = 0 since x  and y are the only tokens                                        //

  // once we have the spot price, we can then calc the BPT price by
  //              balance X + (spot price Y/X * balance Y)                                                     //
  // BPT price = ------------------------------------------                                                    //
  //                           total supply

  //The below formula is used for converting balances => invariant by the Balancer protocol
  /**********************************************************************************************
  // invariant                                                                                 //
  // D = invariant                                                  D^(n+1)                    //
  // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
  // S = sum of balances                                             n^n P                     //
  // P = product of balances                                                                   //
  // n = number of tokens                                                                      //
  *********x************************************************************************************/
  it("Stable Pool Oracle rate proof of concept", async () => {
    //Attempt manipulation, prove that the rates will diverge in such scenario
    //deploy proof of concept oracle
    /**
     const pocOracle = await new RateProofOfConcept__factory(s.Frank).deploy(
      "0x32296969Ef14EB0c6d29669C550D4a0449130230", //pool_address
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", //balancer vault
      ["0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [wstethRelay.address, s.wethOracleAddr], //_oracles
      BN("1"),
      BN("100")
    )
     */
    const bptMinter = "0xb92bDDe847b689B7Ec3a4b900a8443DeBF8e27A4"
    const rETH_WETH_BPT = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
    const rETH = "0xae78736Cd615f374D3085123A210448E74Fc6393"
    const cappedRETH = "0x64eA012919FD9e53bDcCDc0Fc89201F484731f41"
    const rETH_Oracle = "0x69F3d75Fa1eaA2a46005D566Ec784FE9059bb04B"

    const pocOracle = await new RateProofOfConcept__factory(s.Frank).deploy(
      rETH_WETH_BPT, //pool_address
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", //balancer vault
      [rETH, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
      [rETH_Oracle, s.wethOracleAddr], //_oracles, weth oracle
      BN("1"),
      BN("100")
    )

    const wethOracle = IOracleRelay__factory.connect(s.wethOracleAddr, s.Frank)
    const rethOracle = IOracleRelay__factory.connect(rETH_Oracle, s.Frank)

    showBody("reth oracle price: ", await toNumber(await rethOracle.currentValue()))
    showBody("weth oracle price: ", await toNumber(await wethOracle.currentValue()))

    //record safe price
    const initialPrice = await pocOracle.currentValue()
    showBodyCyan("POC initial price: ", await toNumber(initialPrice))

    //steal enough money to repay flash loan
    let weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
    const stealAmount = BN("70000e18") //70k weth
    const borrowAmount = BN("69500e18")

    //fund contract to repay flash loan
    await stealMoney(weth_minter, s.Dave.address, s.WETH.address, stealAmount)
    await s.WETH.connect(s.Dave).transfer(pocOracle.address, stealAmount)
    showBody("weth balance on poc contract: ", await toNumber(await s.WETH.balanceOf(pocOracle.address)))



    //attempt manipulation and check price
    /**
       await pocOracle.testFlashLoanManipulation(BN("1"), borrowAmount, {
       gasPrice: 200000000000, //gas price of 200 gwei - extreeemely high
       gasLimit: 2000000
     })
     */
    await pocOracle.testFlashLoanManipulation(BN("1"), borrowAmount, {
      gasPrice: 200000000000, //gas price of 200 gwei - extreeemely high
      gasLimit: 2000000
    })

  })



  /** 
    it("Deploy and check meta stable pool oracle", async () => {
  
  
      //wstETH/weth MetaStable pool
      stEThMetaStablePoolOracle = await new BPTstablePoolOracle__factory(s.Frank).deploy(
        "0x32296969Ef14EB0c6d29669C550D4a0449130230", //pool_address
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8", //balancer vault
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
  
      const testStableOracle = await new BPTstablePoolOracle__factory(s.Frank).deploy(
        rETH_WETH_BPT, //pool_address
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8", //balancer vault
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
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8", //balancer vault
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
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8", //balancer vault
        [auraToken, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], //_tokens
        [uniAuraRelay.address, s.wethOracleAddr], //_oracles, weth oracle
        BN("1"),
        BN("100")
      )
      await mineBlock()
  
      expect(await toNumber(await testStableOracle.currentValue())).to.be.closeTo(70, 5, "Oracle price within 1% of simple price")
    })
  
  
    // Uni v3 relay
    // Balancer relay, new Balancer weighted pool relay??
    // Current price ~$17
    // aura token = 0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF
    // auraBal = 0x616e8BfA43F920657B3497DBf40D6b1A02D4608d
  
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
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8", //balancer vault
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
  
    //   * Set up oracle for stable pool 'prime' BPT / auraBal LP token 0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd
    //   * This is the oracle used for the price of the reward token being listed
    it("Aura LP token oracle", async () => {
      auraStablePoolLPoracle = await new BPTstablePoolOracle__factory(s.Frank).deploy(
        s.primeAuraBalLP.address,
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8", //balancer vault
        [primeBPT, s.auraBal.address],//prime BPT / auraBal
        [primeBPToracle.address, auraBalAnchorView.address],//prime BPT oracle / auraBal oracle
        BN("1"),
        BN("100")
      )
      await auraStablePoolLPoracle.deployed()
      showBodyCyan("Price for primeBPT / auraBal Aura Stable pool LP: ", await toNumber(await auraStablePoolLPoracle.currentValue()))
  
      showBody("Feed addr: ", s.primeAuraBalLP.address)
      showBody("Underlying price for prime BPT: ", await toNumber(await primeBPToracle.currentValue()))
      showBody("Underlying price for aura Bal : ", await toNumber(await auraBalAnchorView.currentValue()))
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
      //showBody("Live Price: ", await toNumber(await s.Oracle.getLivePrice(s.CappedStethGauge.address)))
  
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
      //showBody("Live Price: ", await toNumber(await s.Oracle.getLivePrice(s.CappedAuraBal.address)))
  
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
      //showBody("Live Price: ", await toNumber(await s.Oracle.getLivePrice(s.CappedAuraLP.address)))
  
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
})