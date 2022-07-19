import { ethers } from "hardhat";
import { Signer } from "ethers";
import {
  CurveMaster__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory,
  IGovernorCharlieDelegate,
  IGovernorCharlieDelegate__factory,
  InterestProtocolTokenDelegate__factory,
  InterestProtocolToken__factory,
  IGovernorCharlieDelegator__factory,
  GovernorCharlieDelegate,
  ProxyAdmin__factory,
  ThreeLines0_100__factory,
  USDI__factory,
  VaultController__factory,
  TransparentUpgradeableProxy__factory,
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { ProposalContext } from "../../suite/proposal";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  reset,
} from "../../../../util/block";
import {
  impersonateAccount,
  ceaseImpersonation,
  stopImpersonate,
  Impersonate,
} from "../../../../util/impersonator";
import { executionAsyncResource } from "async_hooks";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

const description = `
# IP July Update

A small update to Vault Controller and USDi for less friction in transfers.

Adds Optimistic governance to governor charlie

Add GFX labs as an optimistic proposer

`;
const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064";
const voteBlocks = 6570;
const timelockDelay = 43300;

const makeProposal = async () => {};

let gov: GovernorCharlieDelegate;
let x: SignerWithAddress;

describe("Testing change of sale contract", () => {
  it("Does the thing", async () => {
    await reset(15168262);
    const imp = await Impersonate(proposer);
    await imp.start();
    x = await ethers.getSigner(proposer);
    gov = GovernorCharlieDelegate__factory.connect(governorAddress, x);
    /////
    const p = new ProposalContext("mainnet_1_optimistic");

    // deploy the new vault controller
    p.AddDeploy("new_vc", () => {
      return new VaultController__factory(x).deploy();
    });
    p.AddDeploy("new_gov", () => {
      return new GovernorCharlieDelegate__factory(x).deploy();
    });
    p.AddDeploy("new_usdi", () => {
      return new USDI__factory(x).deploy();
    });

    await p.DeployAll();
    // now construct the proposal
    const newGov = await new GovernorCharlieDelegator__factory(x)
    .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
    .populateTransaction._setImplementation(p.db.getData(".deploys.new_gov"));


    const newVC = await new ProxyAdmin__factory(x)
    .attach("0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5")
    .populateTransaction.upgrade(
      "0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3",
      p.db.getData(".deploys.new_vc"),
    )

    const newUSDi = await new ProxyAdmin__factory(x)
    .attach("0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5")
    .populateTransaction.upgrade(
      "0x2a54ba2964c8cd459dc568853f79813a60761b58",
      p.db.getData(".deploys.new_usdi")
    )
    const addOptimisticGFX = await new GovernorCharlieDelegate__factory(x)
    .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
    .populateTransaction._setWhitelistAccountExpiration("0xa6e8772af29b29b9202a073f8e36f447689beef6",31536000)

    p.addStep(newGov, "_setImplementation(address)");
    p.addStep(newVC, "upgrade(address,address)");
    p.addStep(newUSDi, "upgrade(address,address)");
    p.addStep(addOptimisticGFX, "_setWhitelistAccountExpiration(address,uint256)");


    const out = p.populateProposal();
    console.log(out);
    ////
    const charlie = new GovernorCharlieDelegate__factory(x).attach(
      governorAddress
    );

    console.log("sending proposal")
    await p.sendProposal(charlie, description, true).then(mineBlock)
    console.log("voting proposal")
    await gov.castVote(2, 1).then(mineBlock)
    await advanceBlockHeight(voteBlocks);
    console.log("queue proposal")
    await gov.queue(2).then(mineBlock);
    await fastForward(timelockDelay);
    console.log("execute proposal")
    await gov.execute(2).then(mineBlock);
  });
});
