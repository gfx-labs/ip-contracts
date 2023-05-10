import { s } from "../scope";
import { expect } from "chai";
import { showBody } from "../../../../util/format";

import {
  IVault__factory, InterestProtocolTokenDelegate__factory
} from "../../../../typechain-types";
import {
  mineBlock, currentBlock
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
});

describe("Setup, Queue, and Execute proposal", () => {
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"

  it("Set the implementation and verify", async () => {
  
    const ipt = await new InterestProtocolTokenDelegate__factory(s.Frank).attach(s.IPT_Addr)
    const postUpgradeBalance = await toNumber(await ipt.balanceOf(s.owner._address))


    const block = await currentBlock()
    const votes = await ipt.getPriorVotes(proposer, block.number - 2)
    const postVotes = await toNumber(votes)
    showBody("Votes post upgrade: ", postVotes)
    showBody("Balance post upgrade: ", postUpgradeBalance)


  })



})