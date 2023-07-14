import { s } from "../scope";
import { ethers } from "hardhat";
import { expect } from "chai";
import { showBody, showBodyCyan } from "../../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../../util/impersonator"

import { BN } from "../../../../../util/number";
import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  OracleMaster__factory,
  VaultController__factory,
  VotingVaultController__factory,
  ProxyAdmin__factory,
  IOracleRelay,
  WstETHRelay__factory,
  BPTstablePoolOracle__factory,
  CappedBptToken__factory,
  BPTminSafePriceRelay__factory,
  AnchoredViewRelay__factory,
  IGovernorCharlieDelegate__factory
} from "../../../../../typechain-types";
import {
  hardhat_mine,
  fastForward,
  mineBlock,
  currentBlock
} from "../../../../../util/block";
import { toNumber } from "../../../../../util/math";
import { ProposalContext } from "../../../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy } from "../../../../../util/deploy";


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
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not.reverted;
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


describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  let out: any

  before(async () => {
    gov = GovernorCharlieDelegate__factory.connect(governorAddress, s.Frank)
  })
  it("execute", async () => {
    proposal = 29

    await gov.execute(proposal);
    await mineBlock();
  })
})



