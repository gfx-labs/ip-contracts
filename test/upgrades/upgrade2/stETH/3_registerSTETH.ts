import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    IVault__factory,
    UniswapV3OracleRelay__factory,
    ChainlinkOracleRelay__factory,
    StEthOracleRelay__factory,
    GovernorCharlieDelegate__factory,
    GovernorCharlieDelegate
} from "../../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../../../util/block";
import { toNumber, getGas } from "../../../../util/math";
import { DeployContract, DeployContractWithProxy } from "../../../../util/deploy";


const usdcAmount = BN("50e6")
const usdiAmount = BN("50e18")

const USDC_BORROW = BN("1000e6")//1k USDC
const USDI_BORROW = BN("100e18")//500 USDI



require("chai").should();
describe("Register STETH", async () => {

    const wethLTV = BN("850000000000000000")
    const stethAddr = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"
  
    const UNIpool = "0x6c83b0Feef04139EB5520b1cE0e78069C6E7e2c5"
    const ChainlinkFeed = "0xcfe54b5cd566ab89272946f602d76ea879cab4a8"
    const CurveFeed = "0xAb55Bf4DfBf469ebfe082b7872557D1F87692Fe6"
  
    const owner = ethers.provider.getSigner(s.IP_OWNER)
  
    let anchor: AnchoredViewRelay
  
  
    it("Set up oracle", async () => {
  
  
      const CurveRelay = await DeployContract(
        new StEthOracleRelay__factory(s.Frank),
        s.Frank,
        CurveFeed,
        BN("1"),
        BN("1")
      )
      await mineBlock()
      await CurveRelay.deployed()
      expect(await CurveRelay.currentValue()).to.not.eq(0)
  
      //showBody("CurveRelay anchor: ", await toNumber(await CurveRelay.currentValue()))
  
  
      //Create chainlink steth relay
      const ChainlinkRelay = await DeployContract(
        new ChainlinkOracleRelay__factory(s.Frank),
        s.Frank,
        ChainlinkFeed,
        BN("1e10"),
        BN("1")
      )
      await mineBlock()
      await ChainlinkRelay.deployed()
      expect(await ChainlinkRelay.currentValue()).to.not.eq(0)
  
      //showBody("Chainlink main: ", await toNumber(await ChainlinkRelay.currentValue()))
  
  
      //create anchorview 
      anchor = await DeployContract(
        new AnchoredViewRelay__factory(s.Frank),
        s.Frank,
        CurveRelay.address,
        ChainlinkRelay.address,
        BN("30"),
        BN("100")
      )
      await mineBlock()
      await anchor.deployed()
      //showBody(await toNumber(await anchor.currentValue()))
  
  
  
    })
  
    it("Register STETH", async () => {
  
      await impersonateAccount(owner._address)
  
  
      const ethAmount = BN("1e18")
      let tx = {
        to: owner._address,
        value: ethAmount
      }
      await s.Frank.sendTransaction(tx)
      await mineBlock()
  
      await s.Oracle.connect(owner).setRelay(
        stethAddr,
        anchor.address
      )
      await mineBlock()
  
  
      await s.VaultController.connect(owner).registerErc20(
        stethAddr,
        s.wETH_LTV,
        stethAddr,
        s.LiquidationIncentive
      )
      await mineBlock()
      await ceaseImpersonation(owner._address)
  
    })
  })
