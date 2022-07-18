import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

import { BN } from "../../../util/number";
import {
  AnchoredViewRelay,
  USDI__factory,
  IVault__factory,
  UniswapV3OracleRelay__factory,
  ChainlinkOracleRelay__factory,
  StEthOracleRelay__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegate
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
import { AnchoredViewRelay__factory } from "../../../typechain-types";



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

describe("Queue and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064";
  const voteBlocks = 6570;
  const timelockDelay = 43200;
  let gov: GovernorCharlieDelegate;

  it("Queue and Execute", async () => {

    await impersonateAccount(proposer)
    const prop = ethers.provider.getSigner(proposer)

    gov = GovernorCharlieDelegate__factory.connect(governorAddress, prop);

    await gov.castVote(3, 1)
    await advanceBlockHeight(voteBlocks);
    await gov.queue(3);
    await mineBlock()
    await fastForward(timelockDelay);
    await gov.execute(3);
    await mineBlock();

    await ceaseImpersonation(proposer)
  })
})

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