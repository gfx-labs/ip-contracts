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
# Test Description

`;
const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064";
const voteBlocks = 6570;
const timelockDelay = 43300;

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
    const p = new ProposalContext("mainnet_2_lido");

    // construct the proposal


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
