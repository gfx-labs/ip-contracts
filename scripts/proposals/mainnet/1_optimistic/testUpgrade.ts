// this is for testing the govenernance contract on a live deploy
//
//
//
//
// this proposal will do the following
// 1. Upgrade the VaultController implementation
// 2. Upgrade the USDi implementation
// 3. Upgrade the Governor implementation

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
#  Transfer Token


## Details

Transfer token that owns governance
`;
const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064";
const voteBlocks = 6570;
const timelockDelay = 43200;

const makeProposal = async () => {};

let gov: GovernorCharlieDelegate;
let x: SignerWithAddress;

describe("Testing change of sale contract", () => {
  it("Does the thing", async () => {
    await reset(15151469);
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

    const newVC = await new TransparentUpgradeableProxy__factory(x)
    .attach("0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3")
    .populateTransaction.upgradeTo(p.db.getData(".deploys.new_vc"));


    const newUSDi = await new TransparentUpgradeableProxy__factory(x)
    .attach("0x2a54ba2964c8cd459dc568853f79813a60761b58")
    .populateTransaction.upgradeTo(p.db.getData(".deploys.new_usdi"));

    p.addStep(newGov, "_setImplementation(address)");
    p.addStep(newVC, "upgradeTo(address)");
    p.addStep(newUSDi, "upgradeTo(address)");

    const out = p.populateProposal();
    console.log(out);
    ////
    const charlie = new GovernorCharlieDelegate__factory(x).attach(
      governorAddress
    );

    await p.sendProposal(charlie, description, true);
    await gov.castVote(1, 1);
    await advanceBlockHeight(voteBlocks);
    await gov.queue(1);
    await fastForward(timelockDelay);
    await gov.execute(1);
    await mineBlock();
  });
});
