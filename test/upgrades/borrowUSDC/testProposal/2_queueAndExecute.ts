import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory
} from "../../../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  hardhat_mine,
  mineBlock,
  OneWeek,
  OneYear,
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";


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
  const owner = ethers.provider.getSigner(s.IP_OWNER)
  let gov: GovernorCharlieDelegate;
  
  it("Queue and Execute", async () => {

    await impersonateAccount(proposer)
    const prop = ethers.provider.getSigner(proposer)

    gov = GovernorCharlieDelegate__factory.connect(governorAddress, prop);

    await gov.castVote(3, 1)
    await hardhat_mine(voteBlocks);
    await gov.queue(3);
    await mineBlock()
    await fastForward(timelockDelay);
    await gov.execute(3);
    await mineBlock();

    await ceaseImpersonation(proposer)


  })
})