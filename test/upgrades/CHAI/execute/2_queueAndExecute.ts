import { s } from "../scope";
import { expect } from "chai";
import { showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
  IVault__factory,
  CappedGovToken__factory,
  IOracleRelay,
  TransparentUpgradeableProxy__factory
} from "../../../../typechain-types";
import {
  mineBlock,
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
    await s.WETH.connect(s.Carol).transfer(s.CarolVault.address, await s.WETH.balanceOf(s.Carol.address))

  });
});



describe("Deploy Cap Tokens and Oracles", () => {

  const cCHAIaddr = "0xDdAD1d1127A7042F43CFC209b954cFc37F203897"
  const oldImp = "0xB9cb624D4b21E0239bB149B1B1F1992A0eB351b8"

  it("Set capped chai to old implementation", async () => {

    s.CappedCHAI = CappedGovToken__factory.connect(cCHAIaddr, s.Frank)

    const proxy = TransparentUpgradeableProxy__factory.connect(cCHAIaddr, s.Frank)

    await impersonateAccount(s.deployer._address)
    showBodyCyan("TRYING")
    await s.CappedCHAI.connect(s.deployer).transferOwnership(s.owner._address)
    await ceaseImpersonation(s.deployer._address)

    /**
     await impersonateAccount(s.owner._address)
    s.ProxyAdmin.connect(s.owner).upgrade(s.CappedCHAI.address, oldImp)
    await ceaseImpersonation(s.owner._address)
     */

  })
})


