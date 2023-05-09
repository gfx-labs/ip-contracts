import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"
import * as fs from 'fs';

import { BN } from "../../../../util/number";
import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  CappedGovToken__factory,
  UniswapV3TokenOracleRelay__factory,
  UniswapV3TokenOracleRelay,
  AnchoredViewRelay,
  AnchoredViewRelay__factory,
  OracleMaster__factory,
  VaultController__factory,
  VotingVaultController__factory,
  ChainlinkOracleRelay,
  ChainlinkOracleRelay__factory,
  InterestProtocolToken__factory,
  InterestProtocolTokenDelegate__factory
} from "../../../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  currentBlock
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../../util/deploy";



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
    const IPT = await new InterestProtocolToken__factory(s.Frank).attach(s.IPT_Addr)
    let ipt = await new InterestProtocolTokenDelegate__factory(s.Frank).attach(s.IPT_Addr)
    const preBal = await toNumber(await ipt.balanceOf(s.owner._address))


    let block = await currentBlock()
    let votes = await ipt.getPriorVotes(proposer, block.number - 1)
    const preVotes = await toNumber(votes)

    await impersonateAccount(s.owner._address)
    const result = await IPT.connect(s.owner)._setImplementation(s.impAddr)
    await mineBlock()
    const receipt = await result.wait()
    await mineBlock()
    await ceaseImpersonation(s.owner._address)

    await mineBlock()
    await mineBlock()
    await mineBlock()
    await mineBlock()


    const readImpAddr = await IPT.implementation()
    //console.log("Implementation read fr IPT: ", readImpAddr)
    //console.log("Implementation via receipt: ", receipt.events![0].args!.newImplementation)

    expect(s.impAddr).to.eq(readImpAddr).to.eq(receipt.events![0].args!.newImplementation, "All agree on new implementation address")

    ipt = await new InterestProtocolTokenDelegate__factory(s.Frank).attach(s.IPT_Addr)
    const postUpgradeBalance = await toNumber(await ipt.balanceOf(s.owner._address))

    expect(postUpgradeBalance).to.eq(preBal, "Balance is correct after upgrade")

    block = await currentBlock()
    ipt = await new InterestProtocolTokenDelegate__factory(s.Frank).attach(s.IPT_Addr)
    votes = await ipt.getPriorVotes(proposer, block.number - 2)
    const postVotes = await toNumber(votes)
    expect(postVotes).to.eq(preVotes, "Voting power did not change")


  })



})