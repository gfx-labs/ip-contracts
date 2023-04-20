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
  GeneralizedBalancerOracle,
  GeneralizedBalancerOracle__factory,
  OracleRETH,
  BalancerPeggedAssetRelay,
  UniswapV2OracleRelay__factory,
  VaultController,
  ProxyAdmin__factory,
  CHI_Oracle__factory,
  IOracleRelay,
  ChainlinkOracleRelay__factory,
  UniswapV3OracleRelay__factory
} from "../../../../typechain-types";
import {
  advanceBlockHeight,
  hardhat_mine,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  currentBlock
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../../util/deploy";

let anchorViewLINK: IOracleRelay



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


  it("Deploy capped LINK", async () => {
    s.CappedLINK = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedLINK",
      "cLINK",
      s.LINK.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedLINK.deployed()

    await s.CappedLINK.connect(s.Frank).setCap(s.LINK_CAP)

    await s.CappedLINK.connect(s.Frank).transferOwnership(s.owner._address)
  })

  it("Deploy LINK oracle system", async () => {

    //chainlink oracle
    const chainlinkDataFeed = "0x2c1d072e956affc0d435cb7ac38ef18d24d9127c"

    const chainlinkRelay = await new ChainlinkOracleRelay__factory(s.Frank).deploy(
      chainlinkDataFeed,
      BN("1e10"),
      BN("1")
    )
    await chainlinkRelay.deployed()
    showBody("Chainlink data feed price: ", await toNumber(await chainlinkRelay.currentValue()))

    //uni v3 oracle 
    //const uniPool = "0xFAD57d2039C21811C8F2B5D5B65308aa99D31559"//3k LINK/USDC pool
    const uniPool = "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8"//3k LINK/weth pool
    const uniRelay = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
      14400,
      uniPool,
      false,
      BN("1"),
      BN("1")
    )
    await uniRelay.deployed()
    showBody("uni v3 relay price: ", await toNumber(await uniRelay.currentValue()))


    anchorViewLINK = await new AnchoredViewRelay__factory(s.Frank).deploy(
      uniRelay.address,
      chainlinkRelay.address,
      BN("5"),
      BN("100")
    )
    await anchorViewLINK.deployed()
    showBodyCyan("ANCHOR VIEW PRICE: ", await toNumber(await anchorViewLINK.currentValue()))

  })
})




describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  let out: any

  it("Makes the new proposal", async () => {

    await impersonateAccount(proposer)
    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );

    const proposal = new ProposalContext("LINK")

    const addOracleLINK = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedLINK.address,
        anchorViewLINK.address
      )

    const listLINK = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedLINK.address,
        s.LINK_LTV,
        s.CappedLINK.address,
        s.LINK_LiqInc
      )

    const registerLINK_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.LINK.address,
        s.CappedLINK.address
      )

    //list LINK
    proposal.addStep(addOracleLINK, "setRelay(address,address)")
    proposal.addStep(listLINK, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerLINK_VVC, "registerUnderlying(address,address)")




    await ceaseImpersonation(proposer)

    out = proposal.populateProposal()
    //showBody(out)


  })




  
    it("queue and execute", async () => {
     const votingPeriod = await gov.votingPeriod()
     const votingDelay = await gov.votingDelay()
     const timelock = await gov.proposalTimelockDelay()
 
     const block = await currentBlock()
     const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
     expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")
 
     await impersonateAccount(proposer)
     await gov.connect(prop).propose(
       out.targets,
       out.values,
       out.signatures,
       out.calldatas,
       "List LINK",
       false
     )
     await mineBlock()
     proposal = Number(await gov.proposalCount())
     showBodyCyan("Advancing a lot of blocks...")
     await hardhat_mine(votingDelay.toNumber());
 
     await gov.connect(prop).castVote(proposal, 1)
     await mineBlock()
 
     showBodyCyan("Advancing a lot of blocks again...")
     await hardhat_mine(votingPeriod.toNumber());
     await mineBlock()
 
     await gov.connect(prop).queue(proposal);
     await mineBlock()
 
     await fastForward(timelock.toNumber());
     await mineBlock()
 
     await gov.connect(prop).execute(proposal);
     await mineBlock();
 
 
     await ceaseImpersonation(proposer)
 
   })
   

})


