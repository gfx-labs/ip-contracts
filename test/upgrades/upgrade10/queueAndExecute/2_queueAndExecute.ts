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
  BalancerPeggedAssetRelay
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
let rEthSelfRelay: OracleRETH
let rEthUniRelay: UniswapV3TokenOracleRelay
let rEthBalancerRelay: GeneralizedBalancerOracle
let rEthPeggedBalancerRelay: BalancerPeggedAssetRelay
let anchorViewRETH: AnchoredViewRelay

let anchorCBETH: UniswapV3TokenOracleRelay
let mainCBETH: ChainlinkOracleRelay
let anchorViewCBETH: AnchoredViewRelay


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

describe("Deploy Cap Tokens and Oracles", () => {

  const rETH_balancerFeed = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
  const rETH_POOL = "0xa4e0faA58465A2D369aa21B3e42d43374c6F9613"

  const chainlinkCBETHfeed = "0x67eF3CAF8BeB93149F48e8d20920BEC9b4320510"
  const cbETH_POOL = "0x840DEEef2f115Cf50DA625F7368C24af6fE74410"

  it("Deploy capped rETH", async () => {
    s.CappedRETH = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedRETH",
      "crETH",
      s.rETH.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
    await s.CappedRETH.deployed()
    await mineBlock()

    await s.CappedRETH.connect(s.Frank).setCap(s.rETH_Cap)
    await mineBlock()

    await s.CappedRETH.connect(s.Frank).transferOwnership(s.owner._address)
    await mineBlock()
  })

  it("Deploy capped cbETH", async () => {
    s.CappedCBETH = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedCBETH",
      "ccbETH",
      s.cbETH.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
    await s.CappedCBETH.deployed()
    await mineBlock()

    await s.CappedCBETH.connect(s.Frank).setCap(s.cbETH_Cap)
    await mineBlock()

    await s.CappedCBETH.connect(s.Frank).transferOwnership(s.owner._address)
    await mineBlock()
  })

  it("Test rETH self report oracle", async () => {
    //deploy rETH oracle
    rEthSelfRelay = await DeployContract(
      new OracleRETH__factory(s.Frank),
      s.Frank
    )
    await mineBlock()
    await rEthSelfRelay.deployed()
    await mineBlock()

    //showBody("rETH peg price: ", await toNumber(await rEthSelfRelay.currentValue()))
  })

  it("Pegged rETH provider", async () => {
  
    rEthPeggedBalancerRelay = await DeployContract(
      new BalancerPeggedAssetRelay__factory(s.Frank),
      s.Frank,
      14400,
      rETH_balancerFeed,
      "0x1a8F81c256aee9C640e14bB0453ce247ea0DFE6F",
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await rEthPeggedBalancerRelay.deployed()
    await mineBlock()

    const result = await rEthPeggedBalancerRelay.currentValue()
    showBody("Pegged Balancer relay value: ", await toNumber(result))

  })


  it("Deploy Oracle system for rETH", async () => {
    //uniV3Relay
    rEthUniRelay = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      14400,
      rETH_POOL,
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await rEthUniRelay.deployed()
    await mineBlock()

    showBody("Format price from uni V3: ", await toNumber(await rEthUniRelay.currentValue()))
    //showBody("Raw   : ", await rEthUniRelay.currentValue())


    rEthBalancerRelay = await DeployContract(
      new GeneralizedBalancerOracle__factory(s.Frank),
      s.Frank,
      14400,
      rETH_balancerFeed,//rETH/wETH pool
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await rEthBalancerRelay.deployed()
    await mineBlock()
    let price = await rEthBalancerRelay.currentValue()
    //showBody("Price from generalized balancer: ", await toNumber(price))

    anchorViewRETH = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      rEthPeggedBalancerRelay.address, //anchor
      rEthUniRelay.address, //main
      BN("10"),
      BN("100")
    )
    await mineBlock()
    await anchorViewRETH.deployed()
    await mineBlock()

    let result = await anchorViewRETH.currentValue()
    showBodyCyan("rETH Oracle Result: ", await toNumber(result))
  })

  it("Deploy Oracle system for cbETH", async () => {
    //uniV3Relay
    anchorCBETH = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      14400,
      cbETH_POOL,
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await anchorCBETH.deployed()
    await mineBlock()

    showBody("Format price from anchor: ", await toNumber(await anchorCBETH.currentValue()))
    //showBody("Raw   : ", await anchorCBETH.currentValue())

    mainCBETH = await DeployContract(
      new ChainlinkOracleRelay__factory(s.Frank),
      s.Frank,
      chainlinkCBETHfeed,
      BN("1e10"),
      BN("1")
    )
    await mineBlock()
    await mainCBETH.deployed()
    await mineBlock()
    let price = await mainCBETH.currentValue()
    showBody("price: ", await toNumber(price))

    anchorViewCBETH = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      anchorCBETH.address,
      mainCBETH.address,
      BN("20"),
      BN("100")
    )
    await mineBlock()
    await anchorCBETH.deployed()
    await mineBlock()

    let result = await anchorViewCBETH.currentValue()
    showBodyCyan("cbETH Oracle Result: ", await toNumber(result))
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

    const proposal = new ProposalContext("BAL&AAVE")

    const addOracleRETH = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedRETH.address,
        anchorViewRETH.address
      )

    const addOracleCBETH = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedCBETH.address,
        anchorViewCBETH.address
      )


    const listRETH = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedRETH.address,
        s.rETH_LTV,
        s.CappedRETH.address,
        s.rETH_LiqInc
      )

    const listCBETH = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedCBETH.address,
        s.cbETH_LTV,
        s.CappedRETH.address,
        s.cbETH_LiqInc
      )

    //register on voting vault controller
    const registerRETH_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.rETH.address,
        s.CappedRETH.address
      )

    const registerCBETH_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.cbETH.address,
        s.CappedCBETH.address
      )


    //set relays
    proposal.addStep(addOracleRETH, "setRelay(address,address)")
    proposal.addStep(addOracleCBETH, "setRelay(address,address)")

    //register tokens
    proposal.addStep(listRETH, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(listCBETH, "registerErc20(address,uint256,address,uint256)")

    //register underlying on VVC
    proposal.addStep(registerRETH_VVC, "registerUnderlying(address,address)")
    proposal.addStep(registerCBETH_VVC, "registerUnderlying(address,address)")

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
      "List rETH",
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
