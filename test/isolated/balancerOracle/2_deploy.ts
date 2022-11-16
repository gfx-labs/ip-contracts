import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import * as fs from 'fs';

import { BN } from "../../../util/number";
import {
    IVault__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    CappedGovToken__factory,
    UniswapV3TokenOracleRelay__factory,
    UniswapV3TokenOracleRelay,
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    OracleMaster__factory,
    VaultController__factory,
    VotingVaultController__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ITestOracle__factory,
    GeneralizedBalancerOracle__factory
} from "../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
    currentBlock
} from "../../../util/block";
import { toNumber } from "../../../util/math";
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../util/deploy";
import { BigNumber } from "ethers";

let anchorLDO: UniswapV3TokenOracleRelay
let mainLDO: ChainlinkOracleRelay
let anchorViewLDO: AnchoredViewRelay

let anchorDYDX: UniswapV3TokenOracleRelay
let mainDYDX: ChainlinkOracleRelay
let anchorViewDYDX: AnchoredViewRelay

let anchorCRV: UniswapV3TokenOracleRelay
let mainCRV: ChainlinkOracleRelay
let anchorViewCRV: AnchoredViewRelay

require("chai").should();
describe("Verify Contracts", () => {
    it("Should return the right name, symbol, and decimals", async () => {

        expect(await s.USDI.name()).to.equal("USDI Token");
        expect(await s.USDI.symbol()).to.equal("USDI");
        expect(await s.USDI.decimals()).to.equal(18);
    });


    it("Check data on VaultControler", async () => {
        let tokensRegistered = await s.VaultController.tokensRegistered()
        expect(tokensRegistered).to.be.gt(0)
        let interestFactor = await s.VaultController.interestFactor()
        expect(await toNumber(interestFactor)).to.be.gt(1)

    });

    it("mint vaults for testing", async () => {
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
        s.CarolVaultID = await s.VaultController.vaultsMinted()
        vaultAddress = await s.VaultController.vaultAddress(s.CarolVaultID)
        s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
        expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
    });
});

describe("Testing balancer twap", () =>{

  //etherscan - [{variable: 0, secs: 1400, ago: 0}]
  it("Do the thing", async () => {
      const testOracle = ITestOracle__factory.connect("0x1E19CF2D73a72Ef1332C882F20534B6519Be0276", s.Frank)
      const auth = await testOracle.getAuthorizer()

      showBody("Auth: ", auth)


      type input = {
          variable: BigNumber,
          secs: BigNumber,
          ago: BigNumber
      }

      let inp:input = {
          variable:BN("0"),
          secs:BN("14400"),
          ago:BN("0")
      }


      let result = await testOracle.getTimeWeightedAverage([inp])
      showBody("Var 0 : ", result.toString())

      inp = {
          variable:BN("1"),
          secs:BN("14400"),
          ago:BN("0")
      }

      result = await testOracle.getTimeWeightedAverage([inp])
      showBody("Var 1 : ", result.toString())

      inp = {
          variable:BN("2"),
          secs:BN("14400"),
          ago:BN("0")
      }

      result = await testOracle.getTimeWeightedAverage([inp])
      showBody("Var 2 : ", result.toString())
  })

})

describe("Deploy Cap Tokens and Oracles", () => {

    const chainlinkLDOFeed = "0x4e844125952d32acdf339be976c98e22f6f318db"
    const LDO_USDC = "0x78235D08B2aE7a3E00184329212a4d7AcD2F9985"
    const LDO_WETH_3k = "0xa3f558aebAecAf0e11cA4b2199cC5Ed341edfd74"
    const LDO_WETH_10k = "0xf4aD61dB72f114Be877E87d62DC5e7bd52DF4d9B"

    const chainlinkDYDXfeed = "0x478909D4D798f3a1F11fFB25E4920C959B4aDe0b"
    const DYDX_WETH_10k = "0xe0CfA17aa9B8f930Fd936633c0252d5cB745C2C3"

    const chainlinkCRVfeed = "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
    const CRV_WETH_10k = "0x4c83A7f819A5c37D64B4c5A2f8238Ea082fA1f4e"

    it("Deploy and test oracle system for rETH", async () => {

        //balancer token anchor
        const main = await DeployContract(
            new GeneralizedBalancerOracle__factory(s.Frank),
            s.Frank,
            999,
            "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276",//rETH/wETH pool
            false,
            BN("1"),
            BN("1")
        )
        await mineBlock()
        await main.deployed()
        await mineBlock()

        const mainResult = await main.currentValue()
        showBody("rETH Value from balancer oracle: ", await toNumber(mainResult))

        const rETH500 = "0xa4e0faA58465A2D369aa21B3e42d43374c6F9613"
        const anchor = await DeployContract(
          new UniswapV3TokenOracleRelay__factory(s.Frank),
          s.Frank,
          14400,
          rETH500,
          false,
          BN("1"),
          BN("1")
        )
        await mineBlock()
        await anchor.deployed()
        await mineBlock()

        const anchorResult = await anchor.currentValue()
        showBody("rETH Value from uni v3 oracle: ", await toNumber(anchorResult))

        //expect(await toNumber(mainResult)).to.be.closeTo(await toNumber(anchorResult), 80, "Anchor and Main aggree +/- $80")
    })

    it("Deploy and test oracle system for balancer token", async () => {

      //balancer token anchor
      const main = await DeployContract(
          new GeneralizedBalancerOracle__factory(s.Frank),
          s.Frank,
          14400,
          "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56",//rETH/wETH pool
          true,
          BN("1"),
          BN("1")
      )
      await mineBlock()
      await main.deployed()
      await mineBlock()

      const mainResult = await main.currentValue()
      showBody("Balancer Value from balancer oracle: ", await toNumber(mainResult))

      const uniPool = "0xDC2c21F1B54dDaF39e944689a8f90cb844135cc9"
      const anchor = await DeployContract(
        new UniswapV3TokenOracleRelay__factory(s.Frank),
        s.Frank,
        14400,
        uniPool,
        false,
        BN("1"),
        BN("1")
      )
      await mineBlock()
      await anchor.deployed()
      await mineBlock()

      const anchorResult = await anchor.currentValue()
      showBody("Balancer Value from uni v3 oracle: ", await toNumber(anchorResult))

      //expect(await toNumber(mainResult)).to.be.closeTo(await toNumber(anchorResult), 80, "Anchor and Main aggree +/- $80")
  })
  
})
