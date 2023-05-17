import { s } from "../scope";
import { ethers } from "hardhat";
import { expect } from "chai";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator";

import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory
} from "../../../../typechain-types";
import {
  fastForward,
  mineBlock
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";


require("chai").should();
describe("Verify Contracts", () => {
  it("Should return the right name, symbol, and decimals", async () => {

    expect(await s.USDI.name()).to.equal("USDI Token");
    expect(await s.USDI.symbol()).to.equal("USDI");
    expect(await s.USDI.decimals()).to.equal(18);
    //expect(await s.USDI.owner()).to.equal(s.Frank.address);
    //s.owner = await s.USDI.owner()
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
    /**
     
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
    */
});

describe("Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064";
  const voteBlocks = 6570;
  const timelockDelay = 43200;
  const owner = ethers.provider.getSigner(s.IP_OWNER)
  let gov: GovernorCharlieDelegate;

  const proposal = 7

  it("Execute, proposal already queued ", async () => {

    await impersonateAccount(proposer)
    const prop = ethers.provider.getSigner(proposer)

    gov = GovernorCharlieDelegate__factory.connect(governorAddress, prop);

    /**
     await gov.castVote(proposal, 1)
    await advanceBlockHeight(voteBlocks);
    await gov.queue(proposal);
    await mineBlock()
     */
    await fastForward(timelockDelay);
    await gov.execute(proposal);
    await mineBlock();

    await ceaseImpersonation(proposer)


  })

  //proposal does not do this, ownership not transferred
  it("Register underlying on voting vault controller", async () => {

    await impersonateAccount(s.DEPLOYER._address)

    await s.VotingVaultController.connect(s.DEPLOYER).registerUnderlying(s.MATIC.address, s.CappedMatic.address)
    await mineBlock()

    await ceaseImpersonation(s.DEPLOYER._address)


  })
})