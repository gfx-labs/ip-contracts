import { s } from "./scope";
import { ethers } from "hardhat";
import { expect } from "chai";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator";

import { BN } from "../../../../util/number";
import {
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
    s.owner = await s.USDI.owner()
    s.pauser = await s.USDI.pauser()
  });


  it("Check data on VaultControler", async () => {
    let tokensRegistered = await s.VaultController.tokensRegistered()
    expect(tokensRegistered).to.be.gt(0)
    let interestFactor = await s.VaultController.interestFactor()
    expect(await toNumber(interestFactor)).to.be.gt(1)

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

