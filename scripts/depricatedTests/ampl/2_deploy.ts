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
import {toNumber}from "../../../util/math"
import {
  CappedRebaseToken__factory
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
  });
});

describe("Deploy cappedToken contract", () => {
    it("Deploy cappedToken", async () => {
        s.CappedAMPL = await DeployContractWithProxy(
            new CappedRebaseToken__factory(s.Frank),
            s.Frank,
            s.ProxyAdmin,
            "CappedAMPL", 
            "cpAMPL", 
            s.AMPL.address
        )
        await mineBlock();
        await s.CappedAMPL.deployed()
    })

    it("Set Cap", async () => {
        await s.CappedAMPL.connect(s.Frank).setCap(s.AMPL_CAP)
        await mineBlock()
    })

    it("Sanity check", async () => {
        expect(await s.CappedAMPL.getCap()).to.eq(s.AMPL_CAP)
        expect(await s.CappedAMPL.underlyingAddress()).to.eq(s.AMPL.address)
    })
})