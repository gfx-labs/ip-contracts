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
  ChainlinkTokenOracleRelay__factory,
  GeneralizedBalancerOracle,
  GeneralizedBalancerOracle__factory,
  OracleRETH,
  BalancerPeggedAssetRelay,
  UniswapV2OracleRelay__factory,
  VaultController,
  ProxyAdmin__factory
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
import { OracleRETH__factory } from "../../../../typechain-types/factories/oracle/External/OracleRETH.sol/OracleRETH__factory";
import { BalancerPeggedAssetRelay__factory } from "../../../../typechain-types/factories/oracle/External/BalancerPeggedAssetRelay.sol";

let anchorZRX: UniswapV3TokenOracleRelay
let mainZRX: ChainlinkOracleRelay
let anchorViewZRX: AnchoredViewRelay


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
});

describe("Upgrade vault controller", async () => {

  it("Upgrade", async () => {




  })

})

describe("Deploy Cap Tokens and Oracles", () => {

  const currentZRXprice = 0.234

  const chainLinkZRX = "0x2da4983a622a8498bb1a21fae9d8f6c664939962"
  const ZRXuniPool = "0x14424eEeCbfF345B38187d0B8b749E56FAA68539"

  it("Deploy capped ZRX", async () => {
    s.CappedZRX = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedZRX",
      "cZRX",
      s.ZRX.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await s.CappedZRX.deployed()

    await s.CappedZRX.connect(s.Frank).setCap(s.ZRX_CAP)

    await s.CappedZRX.connect(s.Frank).transferOwnership(s.owner._address)
  })


  it("Deploy Oracle system for ZRX", async () => {
    anchorZRX = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
      14400,
      ZRXuniPool,
      true,
      BN("1"),
      BN("1")
    )
    await anchorZRX.deployed()

    expect(await toNumber(await anchorZRX.currentValue())).to.be.closeTo(currentZRXprice, 0.2, "Anchor ZRX price is in the ballpark")


    mainZRX = await new ChainlinkTokenOracleRelay__factory(s.Frank).deploy(
      chainLinkZRX,
      BN("1"),
      BN("1")
    )
    await mainZRX.deployed()

    expect(await toNumber(await mainZRX.currentValue())).to.be.closeTo(currentZRXprice, 0.2, "Main ZRX price is in the ballpark")

    anchorViewZRX = await new AnchoredViewRelay__factory(s.Frank).deploy(
      anchorZRX.address,
      mainZRX.address,
      BN("20"),
      BN("100")
    )
    await anchorViewZRX.deployed()
    expect(await toNumber(await anchorViewZRX.currentValue())).to.be.closeTo(currentZRXprice, 0.2, "Main ZRX price is in the ballpark")

  })
})


describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  let out: any

  let implementation: VaultController


  it("Deploy new VC implementation", async () => {
    implementation = await new VaultController__factory(s.Frank).deploy()

  })

  it("Makes the new proposal", async () => {

    await impersonateAccount(proposer)
    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );

    const proposal = new ProposalContext("ZRX&UNI_LTV")

    const addOracleZRX = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedZRX.address,
        anchorViewZRX.address
      )

    const listZRX = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedZRX.address,
        s.ZRX_LTV,
        s.CappedZRX.address,
        s.ZRX_LiqInc
      )

    const registerZRX_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.ZRX.address,
        s.CappedZRX.address
      )


    //Upgrade VC and set UNI LTV




    //test
    /**
     showBody("Upgrading")
    await impersonateAccount(s.owner._address)
    await s.ProxyAdmin.connect(s.owner).upgrade(s.VaultController.address, implementation.address)
    await impersonateAccount(s.owner._address)
    showBody("done")
     */




    const OracleVerbose = OracleMaster__factory.connect(s.Oracle.address, s.Frank)
    const VaultControllerVerbose = VaultController__factory.connect(s.VaultController.address, s.Frank)
    const currentOracle = await OracleVerbose._relays(s.UNI.address)
    const currentLiqInc = await VaultControllerVerbose._tokenAddress_liquidationIncentive(s.UNI.address)

    //showBody("Current Oracle: ", currentOracle)

    expect(await toNumber(currentLiqInc)).to.eq(0.15, "Current Liquidation Incentive is 0.15, no change needed")

    const updateUniLTV = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.updateRegisteredErc20(
        s.UNI.address,
        s.NEW_UNI_LTV,
        s.UNI.address,
        currentLiqInc
      )

    const upgradeVC = await new ProxyAdmin__factory(prop).
      attach(s.ProxyAdmin.address).
      populateTransaction.upgrade(
        s.VaultController.address,
        implementation.address
      )

    //upgrade VC
    proposal.addStep(upgradeVC, "upgrade(address,address)")
    //UNI LTV
    proposal.addStep(updateUniLTV, "updateRegisteredErc20(address,uint256,address,uint256)")



    //list ZRX
    proposal.addStep(addOracleZRX, "setRelay(address,address)")
    proposal.addStep(listZRX, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerZRX_VVC, "registerUnderlying(address,address)")




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
      "List ZRX & update UNI LTV",
      false
    )
    await mineBlock()
    proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await advanceBlockHeight(votingDelay.toNumber());

    await gov.connect(prop).castVote(proposal, 1)
    await mineBlock()

    showBodyCyan("Advancing a lot of blocks again...")
    await advanceBlockHeight(votingPeriod.toNumber());
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
