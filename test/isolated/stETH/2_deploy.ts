import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

import { BN } from "../../../util/number";
import {
  ProxyAdmin,
  ProxyAdmin__factory,
  USDI__factory,
  IVault__factory,
  UniswapV3OracleRelay__factory,
  ChainlinkOracleRelay__factory
} from "../../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
} from "../../../util/block";
import { toNumber } from "../../../util/math";

import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";



require("chai").should();
describe("Verify Contracts", () => {
  it("Should return the right name, symbol, and decimals", async () => {

    expect(await s.USDI.name()).to.equal("USDI Token");
    expect(await s.USDI.symbol()).to.equal("USDI");
    expect(await s.USDI.decimals()).to.equal(18);
    //expect(await s.USDI.owner()).to.equal(s.Frank.address);
    s.owner = await s.USDI.owner()
    s.pauser = await s.USDI.pauser()
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
    s.CaroLVaultID = await s.VaultController.vaultsMinted()
    vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
    s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
    expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
  });

  it("vault deposits", async () => {
    await expect(s.WETH.connect(s.Bob).transfer(s.BobVault.address, s.Bob_WETH))
      .to.not.reverted;
    await expect(
      s.UNI.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_UNI)
    ).to.not.reverted;
    await mineBlock();

    //showBody("bob transfer weth")
    expect(await s.BobVault.tokenBalance(s.wethAddress)).to.eq(s.Bob_WETH)

    //showBody("carol transfer uni")
    expect(await s.CarolVault.tokenBalance(s.uniAddress)).to.eq(s.Carol_UNI)

  });


  it("Confirm USDI does not have upgraded functions", async () => {

    //depositTo() does not exist, revert without reason string
    await s.USDC.connect(s.Bob).approve(s.USDI.address, BN("50e6"))
    expect(s.USDI.connect(s.Bob).depositTo(BN("50e6"), s.Bob.address)).to.be.reverted

    //deposit some so we can test withdrawTo
    await s.USDI.connect(s.Bob).deposit(BN("50e6"))
    await mineBlock()

    expect(s.USDI.connect(s.Bob).withdrawTo(BN("50e18"), s.Bob.address)).to.be.reverted

    await s.USDI.connect(s.Bob).withdrawAll()
    await mineBlock()

  })

  it("Confirm VaultController does not have upgraded functions", async () => {

    //borrowUSDIto does not exist
    expect(s.VaultController.connect(s.Bob).borrowUSDIto(s.BobVaultID, BN("50e18"), s.Bob.address)).to.be.reverted

    //borrowUSDCto does not exist
    expect(s.VaultController.connect(s.Bob).borrowUSDCto(s.BobVaultID, BN("50e6"), s.Bob.address)).to.be.reverted

  })
});

describe("Deploy upgrades and point proxy to new implementation", () => {

  const owner = ethers.provider.getSigner(s.IP_OWNER)

  it("Deploy and upgrade", async () => {

    const VC_factory = await ethers.getContractFactory("VaultController")
    const VC_imp = await VC_factory.deploy()
    await mineBlock()
    await VC_imp.deployed()

    const USDI_factory = await ethers.getContractFactory("USDI")
    const USDI_imp = await USDI_factory.deploy()
    await mineBlock()
    await USDI_imp.deployed()


    const ethAmount = BN("1e18")
    let tx = {
      to: owner._address,
      value: ethAmount
    }
    await s.Frank.sendTransaction(tx)
    await mineBlock()

    await impersonateAccount(owner._address)

    await s.ProxyAdmin.connect(owner).upgrade(s.VaultController.address, VC_imp.address)
    await mineBlock()

    await s.ProxyAdmin.connect(owner).upgrade(s.USDI.address, USDI_imp.address)
    await mineBlock()

    await ceaseImpersonation(owner._address)
  })
})

describe("Register STETH", async () => {

  const wethLTV = BN("850000000000000000")
  const stethAddr = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"

  const UNIpool = "0x6c83b0Feef04139EB5520b1cE0e78069C6E7e2c5"
  const ChainlinkFeed = "0xcfe54b5cd566ab89272946f602d76ea879cab4a8"

  it("Set up oracle", async () => {
    

    //Create uniswap steth relay
    const UniRelay = await DeployContract(
      new UniswapV3OracleRelay__factory(s.Frank),
      s.Frank,
      60,
      UNIpool,
      false,
      BN("1e10"),
      BN("1")
    )
    await mineBlock()
    await UniRelay.deployed()
    expect(await UniRelay.currentValue()).to.not.eq(0);

    showBody(await UniRelay.currentValue())
    

      

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
    showBody(await ChainlinkRelay.currentValue())


  })

  it("Register STETH", async () => {


  })
})