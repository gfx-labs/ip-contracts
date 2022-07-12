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
  Vault,
  VaultController,
  VaultController__factory,
  IVOTE,
  IVOTE__factory,
  RebasingCapped__factory
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

describe("Deploy cappedToken contract", () => {
    const cap = utils.parseEther("100000")//100K 
    it("Deploy cappedToken", async () => {
        s.RebasingCapped = await DeployContractWithProxy(
            new RebasingCapped__factory(s.Frank),
            s.Frank,
            s.ProxyAdmin,
            "CappedUSDI", 
            "cpUSDI", 
            s.USDI.address
        )
        await mineBlock();
        await s.RebasingCapped.deployed()
    })

    it("Set Cap", async () => {
        await s.RebasingCapped.connect(s.Frank).setCap(s.CAP)//100K
        await mineBlock()
    })

    it("Sanity check", async () => {
        expect(await s.RebasingCapped.getCap()).to.eq(s.CAP)
        expect(await s.RebasingCapped.underlyingAddress()).to.eq(s.USDI.address)
    })

   
})