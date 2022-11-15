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
    ChainlinkTokenOracleRelay__factory,
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

describe("Deploy Cap Tokens and Oracles", () => {

    const chainlinkLDOFeed = "0x4e844125952d32acdf339be976c98e22f6f318db"
    const LDO_USDC = "0x78235D08B2aE7a3E00184329212a4d7AcD2F9985"
    const LDO_WETH_3k = "0xa3f558aebAecAf0e11cA4b2199cC5Ed341edfd74"
    const LDO_WETH_10k = "0xf4aD61dB72f114Be877E87d62DC5e7bd52DF4d9B"

    const chainlinkDYDXfeed = "0x478909D4D798f3a1F11fFB25E4920C959B4aDe0b"
    const DYDX_WETH_10k = "0xe0CfA17aa9B8f930Fd936633c0252d5cB745C2C3"

    const chainlinkCRVfeed = "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
    const CRV_WETH_10k = "0x4c83A7f819A5c37D64B4c5A2f8238Ea082fA1f4e"



    it("Deploy capped rETH", async () => {

        s.CappedRETH = await DeployContractWithProxy(
            new CappedGovToken__factory(s.Frank),
            s.Frank,
            s.ProxyAdmin,
            "CappedRETH",
            "crETH",
            s.rETH.address,
            s.VaultController.address,
            s.VotingVaultController.address
        )
        await mineBlock()
        await s.CappedRETH.deployed()
        await mineBlock()

        await s.CappedRETH.connect(s.Frank).setCap(s.LDO_Cap)
        await mineBlock()

    })


    it("Deploy Oracle system for rETH", async () => {

        //balancer token anchor
        const anchor = await DeployContract(
            new GeneralizedBalancerOracle__factory(s.Frank),
            s.Frank,
            14400,
            "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276",
            BN("1"),
            BN("1")
        )
        await mineBlock()
        await anchor.deployed()
        await mineBlock()

        const anchorResult = await anchor.currentValue()
        showBody("Value: ", await toNumber(anchorResult))


        /**
         
        //uniV3Relay
        anchorLDO = await DeployContract(
          new UniswapV3TokenOracleRelay__factory(s.Frank),
          s.Frank,
          14400,
          LDO_WETH_10k,
          false,
          BN("1"),
          BN("1")
        )
        await mineBlock()
        await anchorLDO.deployed()
        await mineBlock()
    
        //showBody("Format price from anchor: ", await toNumber(await anchorLDO.currentValue()))
        //showBody("Raw   : ", await anchorLDO.currentValue())
    
        mainLDO = await DeployContract(
          new ChainlinkTokenOracleRelay__factory(s.Frank),
          s.Frank,
          chainlinkLDOFeed,
          BN("1"),
          BN("1")
        )
        await mineBlock()
        await mainLDO.deployed()
        await mineBlock()
        let price = await mainLDO.currentValue()
        //showBody("price: ", await toNumber(price))
    
        anchorViewLDO = await DeployContract(
          new AnchoredViewRelay__factory(s.Frank),
          s.Frank,
          anchorLDO.address,
          mainLDO.address,
          BN("20"),
          BN("100")
        )
        await mineBlock()
        await anchorViewLDO.deployed()
        await mineBlock()
    
        let result = await anchorViewLDO.currentValue()
        showBodyCyan("LDO Oracle Result: ", await toNumber(result))
         */

    })
    /**
    it("Deploy Oracle system for DYDX", async () => {
  
      //uniV3Relay
      anchorDYDX = await DeployContract(
        new UniswapV3TokenOracleRelay__factory(s.Frank),
        s.Frank,
        14400,
        DYDX_WETH_10k,
        false,
        BN("1"),
        BN("1")
      )
      await mineBlock()
      await anchorDYDX.deployed()
      await mineBlock()
  
      //showBody("Format price from anchor: ", await toNumber(await anchorDYDX.currentValue()))
      //showBody("Raw   : ", await anchorDYDX.currentValue())
  
      mainDYDX = await DeployContract(
        new ChainlinkOracleRelay__factory(s.Frank),
        s.Frank,
        chainlinkDYDXfeed,
        BN("1e10"),
        BN("1")
      )
      await mineBlock()
      await mainDYDX.deployed()
      await mineBlock()
      //showBody("price: ", await toNumber(await mainDYDX.currentValue()))
  
      anchorViewDYDX = await DeployContract(
        new AnchoredViewRelay__factory(s.Frank),
        s.Frank,
        anchorDYDX.address,
        mainDYDX.address,
        BN("20"),
        BN("100")
      )
      await mineBlock()
      await anchorViewDYDX.deployed()
      await mineBlock()
  
      let result = await anchorViewDYDX.currentValue()
      showBodyCyan("DYDX Oracle Result: ", await toNumber(result))
    })
  
    it("Deploy Oracle system for CRV", async () => {
  
      //uniV3Relay
      anchorCRV = await DeployContract(
        new UniswapV3TokenOracleRelay__factory(s.Frank),
        s.Frank,
        14400,
        CRV_WETH_10k,
        true,
        BN("1"),
        BN("1")
      )
      await mineBlock()
      await anchorCRV.deployed()
      await mineBlock()
  
      //showBody("Format price from anchor: ", await toNumber(await anchorCRV.currentValue()))
      //showBody("Raw   : ", await anchorCRV.currentValue())
  
      mainCRV = await DeployContract(
        new ChainlinkOracleRelay__factory(s.Frank),
        s.Frank,
        chainlinkCRVfeed,
        BN("1e10"),
        BN("1")
      )
      await mineBlock()
      await mainCRV.deployed()
      await mineBlock()
      //showBody("price: ", await toNumber(await mainCRV.currentValue()))
  
  
      anchorViewCRV = await DeployContract(
        new AnchoredViewRelay__factory(s.Frank),
        s.Frank,
        anchorCRV.address,
        mainCRV.address,
        BN("20"),
        BN("100")
      )
      await mineBlock()
      await anchorViewCRV.deployed()
      await mineBlock()
  
      let result = await anchorViewCRV.currentValue()
      showBodyCyan("CRV Oracle Result: ", await toNumber(result))
    })
  
    */
})
