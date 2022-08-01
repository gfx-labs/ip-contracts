import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { upgrades, ethers } from "hardhat";

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
  CappedFeeOnTransferToken__factory
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



describe("Deploy CappedPAXG contract", () => {


  const owner = ethers.provider.getSigner(s.IP_OWNER)
  const ethAmount = BN("1e18")
  let tx = {
    to: owner._address,
    value: ethAmount
  }

  before(async () => {
    await s.Frank.sendTransaction(tx)
    await mineBlock()

  })
  it("Deploy CappedPAXG", async () => {
    s.CappedPAXG = await DeployContractWithProxy(
      new CappedFeeOnTransferToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedPAXG",
      "cpPAXG",
      s.PAXG_ADDR,
      d.VaultController
    )
    await mineBlock();
    await s.CappedPAXG.deployed()
  })

  it("Set Cap", async () => {
    await s.CappedPAXG.connect(s.Frank).setCap(s.PAXG_CAP)//100K USDC
    await mineBlock()
  })

  it("Sanity check", async () => {
    expect(await s.CappedPAXG.getCap()).to.eq(s.PAXG_CAP)
    expect(await s.CappedPAXG._underlying()).to.eq(s.PAXG.address)
  })


  it("Deploy oracle system for PAXG", async () => {
    
  })






})