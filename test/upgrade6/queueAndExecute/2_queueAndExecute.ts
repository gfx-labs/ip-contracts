import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

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
  VotingVaultController__factory
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
  /**
   
  it("vault deposits", async () => {
    await expect(s.WETH.connect(s.Bob).transfer(s.BobVault.address, s.Bob_WETH))
      .to.not.reverted;
    await expect(
      s.UNI.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_UNI)
    ).to.not.reverted;
    await mineBlock();

    //showBody("bob transfer weth")
    expect(await s.BobVault.tokenBalance(s.wethAddress)).to.eq(s.Bob_WETH)

    //showBody("carol transfer uni")
    expect(await s.CarolVault.tokenBalance(s.uniAddress)).to.eq(s.Carol_UNI)

  });
  */
});

describe("Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  const voteBlocks = 6570;
  const timelockDelay = 43200;
  const owner = ethers.provider.getSigner(s.IP_OWNER)
  let gov: GovernorCharlieDelegate;

  let proposal: number

  const usdc3k = "0x619154DBD96b4c1A8112651DB9A451E475daf77F"//582 USDC liquidity
  const usdc10k = "0x5F7E8408e573e934B0df49Ba5b569c30f1eBBaD4"//~905 USDC liquidity

  const weth3k = "0x92560C178cE069CC014138eD3C2F5221Ba71f58a"//good liquidity - 910 weth, ~$3.4mm TVL 
  const weth10k = "0xb9C4a5522a2f8bA9E2fF7063Df8C02ed443337A3"//reasonable liquidity - 100 weth, ~$440k TVL 

  const chainLinkDataFeed = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"
  let anchor: UniswapV3TokenOracleRelay
  let anchorView: AnchoredViewRelay

  let out: any
  it("Deploy CappedENS", async () => {
    s.CappedENS = await DeployContractWithProxy(
      new CappedGovToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "CappedENS",
      "cENS",
      s.ENS.address,
      s.VaultController.address,
      s.VotingVaultController.address
    )
    await mineBlock()
    await s.CappedENS.deployed()
    await mineBlock()

    await s.CappedENS.connect(s.Frank).setCap(s.ENS_CAP)
    await mineBlock()
  })

  it("Deploy Oracle system for ENS", async () => {

    //uniV3Relay
    anchor = await DeployContract(
      new UniswapV3TokenOracleRelay__factory(s.Frank),
      s.Frank,
      60,
      weth3k,
      true,//weth is token0
      BN("1"),
      BN("1")
    )
    await mineBlock()
    await anchor.deployed()
    await mineBlock()

    anchorView = await DeployContract(
      new AnchoredViewRelay__factory(s.Frank),
      s.Frank,
      anchor.address,
      anchor.address,
      BN("10"),
      BN("100")
    )
    await mineBlock()
    await anchorView.deployed()
    await mineBlock()

    let result = await anchorView.currentValue()
    showBody("Result: ", await toNumber(result))

  })

  it("Makes the new proposal", async () => {
    await impersonateAccount(proposer)

    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );

    const proposal = new ProposalContext("ENS")

    const addOracle = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedENS.address,
        anchorView.address
      )


    const listENS = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedENS.address,
        BN("75e16"),
        s.CappedENS.address,
        BN("10e16")
      )

    //register on voting vault controller
    const registerVVC = await new VotingVaultController__factory(prop).
      attach(s.VotingVaultController.address).
      populateTransaction.registerUnderlying(
        s.ENS.address,
        s.CappedENS.address
      )


    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(listENS, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerVVC, "registerUnderlying(address,address)")


    out = proposal.populateProposal()
    /** 
    showBody(out)
    {
      targets: [
        '0xf4818813045E954f5Dc55a40c9B60Def0ba3D477',
        '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3',
        '0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2'
      ],
      values: [ 0, 0, 0 ],
      signatures: [
        'setRelay(address,address)',
        'registerErc20(address,uint256,address,uint256)',
        'registerUnderlying(address,address)'
      ],
      calldatas: [
        '0x000000000000000000000000286b8decd5ed79c962b2d8f4346cd97ff0e2c3520000000000000000000000009338ca7d556248055f5751d85cda7ad6ef254433',
        '0x000000000000000000000000286b8decd5ed79c962b2d8f4346cd97ff0e2c3520000000000000000000000000000000000000000000000000a688906bd8b0000000000000000000000000000286b8decd5ed79c962b2d8f4346cd97ff0e2c352000000000000000000000000000000000000000000000000016345785d8a0000',
        '0x000000000000000000000000c18360217d8f7ab5e7c516566761ea12ce7f9d72000000000000000000000000286b8decd5ed79c962b2d8f4346cd97ff0e2c352'
      ]
    }
    */
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
      "List ENS",
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