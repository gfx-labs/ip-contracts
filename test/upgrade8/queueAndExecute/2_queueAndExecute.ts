import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import * as fs from 'fs';

import { BN } from "../../../util/number";
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
  ChainlinkTokenOracleRelay__factory
} from "../../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  currentBlock
} from "../../../util/block";
import { toNumber } from "../../../util/math";
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../util/deploy";

const proposalText = fs.readFileSync('test/upgrade6/queueAndExecute/proposal.md', 'utf8');
let anchorLDO: UniswapV3TokenOracleRelay
let mainLDO: ChainlinkOracleRelay
let anchorViewLDO: AnchoredViewRelay

let anchorDYDX: UniswapV3TokenOracleRelay
let mainDYDX: ChainlinkOracleRelay
let anchorViewDYDX: AnchoredViewRelay

let anchorCRV: UniswapV3TokenOracleRelay
let mainCRV: ChainlinkOracleRelay
let anchorViewCRV: AnchoredViewRelay

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

  const chainlinkLDOFeed = "0x4e844125952d32acdf339be976c98e22f6f318db"
  const LDO_USDC = "0x78235D08B2aE7a3E00184329212a4d7AcD2F9985"
  const LDO_WETH_3k = "0xa3f558aebAecAf0e11cA4b2199cC5Ed341edfd74"
  const LDO_WETH_10k = "0xf4aD61dB72f114Be877E87d62DC5e7bd52DF4d9B"

  const chainlinkDYDXfeed = "0x478909D4D798f3a1F11fFB25E4920C959B4aDe0b"
  const DYDX_WETH_10k = "0xe0CfA17aa9B8f930Fd936633c0252d5cB745C2C3"

  const chainlinkCRVfeed = "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
  const CRV_WETH_10k = "0x4c83A7f819A5c37D64B4c5A2f8238Ea082fA1f4e"



  it("Deploy capped LDO", async () => {
    s.CappedLDO = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedLDO",
      "cLDO",
      s.LDO.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
    await s.CappedLDO.deployed()
    await mineBlock()

    await s.CappedLDO.connect(s.Frank).setCap(s.LDO_Cap)
    await mineBlock()
  })

  it("Deploy capped DYDX", async () => {
    s.CappedDYDX = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedDYDX",
      "cDYDX",
      s.DYDX.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
    await s.CappedDYDX.deployed()
    await mineBlock()

    await s.CappedDYDX.connect(s.Frank).setCap(s.DYDX_Cap)
    await mineBlock()
  })

  it("Deploy capped CRV", async () => {
    s.CappedCRV = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedCRV",
      "cCRV",
      s.CRV.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
    await s.CappedCRV.deployed()
    await mineBlock()

    await s.CappedCRV.connect(s.Frank).setCap(s.CRV_Cap)
    await mineBlock()
  })

  it("Deploy Oracle system for LDO", async () => {

    //uniV3Relay
    anchorLDO = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      14400,
      LDO_WETH_10k,
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await anchorLDO.deployed()
    await mineBlock()

    //showBody("Format price from anchor: ", await toNumber(await anchorLDO.currentValue()))
    //showBody("Raw   : ", await anchorLDO.currentValue())

    mainLDO = await DeployContract(
      new ChainlinkTokenOracleRelay__factory(s.Frank),
      s.Frank,
      chainlinkLDOFeed,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await mainLDO.deployed()
    await mineBlock()
    let price = await mainLDO.currentValue()
    //showBody("price: ", await toNumber(price))

    anchorViewLDO = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      anchorLDO.address,
      mainLDO.address,
      BN("20"),
      BN("100")
    )
    await mineBlock()
    await anchorViewLDO.deployed()
    await mineBlock()

    let result = await anchorViewLDO.currentValue()
    showBodyCyan("LDO Oracle Result: ", await toNumber(result))

  })

  it("Deploy Oracle system for DYDX", async () => {

    //uniV3Relay
    anchorDYDX = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      14400,
      DYDX_WETH_10k,
      false,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await anchorDYDX.deployed()
    await mineBlock()

    //showBody("Format price from anchor: ", await toNumber(await anchorDYDX.currentValue()))
    //showBody("Raw   : ", await anchorDYDX.currentValue())

    mainDYDX = await DeployContract(
      new ChainlinkOracleRelay__factory(s.Frank),
      s.Frank,
      chainlinkDYDXfeed,
      BN("1e10"),
      BN("1")
    )
    await mineBlock()
    await mainDYDX.deployed()
    await mineBlock()
    //showBody("price: ", await toNumber(await mainDYDX.currentValue()))

    anchorViewDYDX = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      anchorDYDX.address,
      mainDYDX.address,
      BN("20"),
      BN("100")
    )
    await mineBlock()
    await anchorViewDYDX.deployed()
    await mineBlock()

    let result = await anchorViewDYDX.currentValue()
    showBodyCyan("DYDX Oracle Result: ", await toNumber(result))
  })

  it("Deploy Oracle system for CRV", async () => {

    //uniV3Relay
    anchorCRV = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      14400,
      CRV_WETH_10k,
      true,
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await anchorCRV.deployed()
    await mineBlock()

    //showBody("Format price from anchor: ", await toNumber(await anchorCRV.currentValue()))
    //showBody("Raw   : ", await anchorCRV.currentValue())

    mainCRV = await DeployContract(
      new ChainlinkOracleRelay__factory(s.Frank),
      s.Frank,
      chainlinkCRVfeed,
      BN("1e10"),
      BN("1")
    )
    await mineBlock()
    await mainCRV.deployed()
    await mineBlock()
    //showBody("price: ", await toNumber(await mainCRV.currentValue()))


    anchorViewCRV = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      anchorCRV.address,
      mainCRV.address,
      BN("20"),
      BN("100")
    )
    await mineBlock()
    await anchorViewCRV.deployed()
    await mineBlock()

    let result = await anchorViewCRV.currentValue()
    showBodyCyan("CRV Oracle Result: ", await toNumber(result))
  })
})


describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  const bal3k = "0xDC2c21F1B54dDaF39e944689a8f90cb844135cc9"//bal/weth ~$280k liquidity, the only viable pool
  const balDataFeed = "0xdf2917806e30300537aeb49a7663062f4d1f2b5f"

  const aave3k = "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"//aave/weth ~$906k liqudiity, the best pool by far
  const aaveDataFeed = "0x547a514d5e3769680ce22b2361c10ea13619e8a9"




  let out: any

  it("Makes the new proposal", async () => {

    await impersonateAccount(proposer)

    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );

    const proposal = new ProposalContext("BAL&AAVE")

    const addOracleLDO = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedLDO.address,
        anchorViewLDO.address
      )

    const addOracleDYDX = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedDYDX.address,
        anchorViewDYDX.address
      )

    const addOracleCRV = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedCRV.address,
        anchorViewCRV.address
      )

    const listLDO = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedLDO.address,
        s.CRV_LTV,
        s.CappedLDO.address,
        s.CRV_LiqInc
      )
    const listDYDX = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedDYDX.address,
        s.DYDX_LTV,
        s.CappedDYDX.address,
        s.DYDX_LiqInc
      )
    const ListCRV = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedCRV.address,
        s.CRV_LTV,
        s.CappedCRV.address,
        s.CRV_LiqInc
      )

    //register on voting vault controller
    const registerLDO_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.LDO.address,
        s.CappedLDO.address
      )

    const registerDYDX_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.DYDX.address,
        s.CappedDYDX.address
      )

    const registerCRV_VVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.CRV.address,
        s.CappedCRV.address
      )


    //set relays
    proposal.addStep(addOracleLDO, "setRelay(address,address)")
    proposal.addStep(addOracleDYDX, "setRelay(address,address)")
    proposal.addStep(addOracleCRV, "setRelay(address,address)")


    //register tokens
    proposal.addStep(listLDO, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(listDYDX, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(ListCRV, "registerErc20(address,uint256,address,uint256)")

    //register underlying on VVC
    proposal.addStep(registerLDO_VVC, "registerUnderlying(address,address)")
    proposal.addStep(registerDYDX_VVC, "registerUnderlying(address,address)")
    proposal.addStep(registerCRV_VVC, "registerUnderlying(address,address)")


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
      "List LDO, DYDX, & CRV",
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
