import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { BN } from "../../util/number";
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
} from "../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
} from "../../util/block";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { DeployContract, DeployContractWithProxy } from "../../util/deploy";
import { toNumber } from "../../util/math";
let ProxyController: ProxyAdmin;

const deployProxy = async () => {
  s.ProxyAdmin = await DeployContract(
    new ProxyAdmin__factory(s.Frank),
    s.Frank
  );
  await mineBlock();
  s.VaultController = await DeployContractWithProxy(
    new VaultController__factory(s.Frank),
    s.Frank,
    s.ProxyAdmin
  );
  await mineBlock();
  s.USDI = await DeployContractWithProxy(
    new USDI__factory(s.Frank),
    s.Frank,
    s.ProxyAdmin,
    s.usdcAddress
  );
  await mineBlock();

  await expect(s.USDI.setVaultController(s.VaultController.address)).to.not.reverted
  await mineBlock();
};

require("chai").should();
describe("Deploy Contracts", () => {
  before(async () => {
    //await deployProxy();
  });

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
