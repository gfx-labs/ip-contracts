import { ethers } from "hardhat";
import { Signer } from "ethers";
import {
  CurveMaster__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory,
  InterestProtocolTokenDelegate__factory,
  InterestProtocolToken__factory,
  IGovernorCharlieDelegator__factory,
  GovernorCharlieDelegate,
  ProxyAdmin__factory,
  ThreeLines0_100__factory,
  USDI__factory,
  VaultController__factory,
  TransparentUpgradeableProxy__factory,
  OracleMaster__factory,
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


const lido_token_address = "0xae7ab96520de3a18e5e111b5eaab095312d7fe84";

describe("Testing change of sale contract", () => {
  it("Does the thing", async () => {
    await reset(15175227);
    const imp = await Impersonate(proposer);
    await imp.start();
    x = await ethers.getSigner(proposer);
    gov = GovernorCharlieDelegate__factory.connect(governorAddress, x);
    /////
    const p = new ProposalContext("mainnet_3_patch");

    // new governor
    p.AddDeploy("new_vc", () => {
      return new VaultController__factory(x).deploy();
    });

    await p.DeployAll();
    const newVC = await new ProxyAdmin__factory(x)
    .attach("0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5")
    .populateTransaction.upgrade(
      "0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3",
      p.db.getData(".deploys.new_vc"),
    )

    const changeTBL = await new VaultController__factory(x)
    .attach("0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3").populateTransaction
    .changeTBL(false, BN("3208100e18"))

    p.addStep(newVC, "upgrade(address,address)");
    p.addStep(changeTBL, "changeTBL(bool,uint192)");

    const out = p.populateProposal();
    const charlie = new GovernorCharlieDelegate__factory(x).attach(
      "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
    );

    console.log(out)
    console.log("PLEASE CHECK PROPOSAL! PROPOSING IN 10 seconds")
    await countdownSeconds(10)
    console.log("sending transaction....")

    const out = p.populateProposal();
    console.log(out);
    ////
    const charlie = new GovernorCharlieDelegate__factory(x).attach(
      governorAddress
    );

    console.log("sending proposal")
    await p.sendProposal(charlie, description, true).then(mineBlock)
    console.log("voting proposal")
    await gov.castVote(5, 1).then(mineBlock)
    await advanceBlockHeight(voteBlocks);
    console.log("queue proposal")
    await gov.queue(5).then(mineBlock);
    await fastForward(timelockDelay);
    console.log("execute proposal")
    await gov.execute(5).then(mineBlock);
  });
});
