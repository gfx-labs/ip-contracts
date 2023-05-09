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
  currentBlock,
  hardhat_mine
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



describe("Setup, Queue, and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  let out: any

  const implementation = "0x9BDb5575E24EEb2DCA7Ba6CE367d609Bdeb38246"
  const CappedZRX_ADDR = "0xDf623240ec300fD9e2B7780B34dC2F417c0Ab6D2"
  const anchorViewAddr = "0xEF12fa3183362506A2dd0ff1CF06b2f4156e751E"

  it("Connect to mainnet deployments", async () => {

    s.CappedZRX = new CappedGovToken__factory(s.Frank).attach(CappedZRX_ADDR)
    anchorViewZRX = new AnchoredViewRelay__factory(s.Frank).attach(anchorViewAddr)

  })

  it("Transfer ownership for future tests", async () => {
    await impersonateAccount(s.deployer._address)
    await s.CappedZRX.connect(s.deployer).transferOwnership(s.owner._address)
    await ceaseImpersonation(s.deployer._address)
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
        implementation
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

  const scriptOutput = {
    targets: [
      '0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5',
      '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3',
      '0xf4818813045E954f5Dc55a40c9B60Def0ba3D477',
      '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3',
      '0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2'
    ],
    values: [0, 0, 0, 0, 0],
    signatures: [
      'upgrade(address,address)',
      'updateRegisteredErc20(address,uint256,address,uint256)',
      'setRelay(address,address)',
      'registerErc20(address,uint256,address,uint256)',
      'registerUnderlying(address,address)'
    ],
    calldatas: [
      '0x0000000000000000000000004aae9823fb4c70490f1d802fc697f3fff8d5cbe30000000000000000000000009bdb5575e24eeb2dca7ba6ce367d609bdeb38246',
      '0x0000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f98400000000000000000000000000000000000000000000000009b6e64a8ec600000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000214e8348c4f0000',
      '0x000000000000000000000000df623240ec300fd9e2b7780b34dc2f417c0ab6d2000000000000000000000000ef12fa3183362506a2dd0ff1cf06b2f4156e751e',
      '0x000000000000000000000000df623240ec300fd9e2b7780b34dc2f417c0ab6d200000000000000000000000000000000000000000000000006f05b59d3b20000000000000000000000000000df623240ec300fd9e2b7780b34dc2f417c0ab6d20000000000000000000000000000000000000000000000000214e8348c4f0000',
      '0x000000000000000000000000e41d2489571d322189246dafa5ebde1f4699f498000000000000000000000000df623240ec300fd9e2b7780b34dc2f417c0ab6d2'
    ]
  }

  it("queue and execute", async () => {
    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
    expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")

    //expect(scriptOutput.targets).to.eq(out.targets, "Script data matches proposal output")

    await impersonateAccount(proposer)
    await gov.connect(prop).propose(
      scriptOutput.targets,
      scriptOutput.values,
      scriptOutput.signatures,
      scriptOutput.calldatas,
      "List ZRX & update UNI LTV",
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
