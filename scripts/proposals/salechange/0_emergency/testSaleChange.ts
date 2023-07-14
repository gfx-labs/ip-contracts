// this is for testing the govenernance contract on a live deploy
//
//
//
//
// this proposal will do the following
// 1. Upgrade the VaultController implementation
// 2. Upgrade the USDi implementation
// 3. Upgrade the Governor implementation
// 4. Set a new interest rate curve
// 5. Modify a parameter of an existing token

import { ethers } from "hardhat";
import {
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory, InterestProtocolToken__factory, GovernorCharlieDelegate
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
  Impersonate
} from "../../../../util/impersonator";
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
    await reset(14964588);
    const imp = await Impersonate(proposer);
    await imp.start();
    x = await ethers.getSigner(proposer);
    gov = GovernorCharlieDelegate__factory.connect(governorAddress, x);
    const p = new ProposalContext("polygonNormal");
    const totalSupply_ = BN("1e26");
    // deploy the new vault controller
    p.AddDeploy("new_ipt", () => {
      return new InterestProtocolToken__factory(x).deploy(
        x.address,
        x.address,
        "0x35Bb90c0B96DdB4B93ddF42aFEDd5204E91A1A10",
        totalSupply_
      );
    });
    p.AddDeploy("new_gov", () => {
      return new GovernorCharlieDelegate__factory(x).deploy();
    });
    await p.DeployAll();

    const nl = p.db.getData(".deploys.new_gov");
    // now construct the proposal
    const newGov = await new GovernorCharlieDelegator__factory(x)
      .attach(governorAddress)
      .populateTransaction._setImplementation(nl);

    const nt = p.db.getData(".deploys.new_ipt");

    const newIPT = await new GovernorCharlieDelegate__factory(x)
      .attach(governorAddress)
      .populateTransaction._setNewToken(nt);

    p.addStep(newGov, "_setImplementation(address)");

    p.addStep(newIPT, "_setNewToken(address)");

    const out = p.populateProposal();
    console.log(out);

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

    console.log(nt);
    expect(await gov.ipt()).to.eq(nt);
  });
});
