import { ethers } from "hardhat";
import {
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory, GovernorCharlieDelegate, VaultController__factory, OracleMaster__factory
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
    const p = new ProposalContext("mainnet_2_lido");

    // construct the proposal

    const addOracle = await new OracleMaster__factory(x).
      attach("0xf4818813045e954f5dc55a40c9b60def0ba3d477")
    .populateTransaction.setRelay(
      lido_token_address,
      p.db.getData(".deploys.new_anchored")
    )
    const listLido = await  new VaultController__factory(x).
      attach("0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3").
    populateTransaction.registerErc20(
      lido_token_address,
      BN("10e16"),
      lido_token_address,
      BN("75e16"),
    )
    const addOptimisticGFX = await new GovernorCharlieDelegate__factory(x)
    .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
    .populateTransaction._setWhitelistAccountExpiration(
      "0xa6e8772af29b29b9202a073f8e36f447689beef6",
      1658261294+30000000,
    )

    const newGov = await new GovernorCharlieDelegator__factory(x)
    .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
    .populateTransaction._setImplementation(p.db.getData(".deploys.new_gov"));

    const govSetPeriod = await new GovernorCharlieDelegate__factory(x)
    .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
    .populateTransaction.setMaxWhitelistPeriod(31536000)

    const govSetOpVotes = await new GovernorCharlieDelegate__factory(x)
    .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
    .populateTransaction["_setOptimisticQuorumVotes(uint256)"]("2000000000000000000000000")

    const govSetOpDelay = await new GovernorCharlieDelegate__factory(x)
    .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
    .populateTransaction._setOptimisticDelay(18000)

    p.addStep(newGov, "_setImplementation(address)");
    p.addStep(govSetPeriod, "setMaxWhitelistPeriod(uint256)")
    p.addStep(govSetOpVotes, "_setOptimisticQuorumVotes(uint256)")
    p.addStep(govSetOpDelay, "_setOptimisticDelay(uint256)")

    p.addStep(addOracle, "setRelay(address,address)");
    p.addStep(listLido, "registerErc20(address,uint256,address,uint256)");
    p.addStep(addOptimisticGFX, "_setWhitelistAccountExpiration(address,uint256)");


    const out = p.populateProposal();
    console.log(out);
    ////
    const charlie = new GovernorCharlieDelegate__factory(x).attach(
      governorAddress
    );

    console.log("sending proposal")
    await fastForward(timelockDelay);
    await gov.execute(3).then(mineBlock);
    await p.sendProposal(charlie, description, true).then(mineBlock)
    console.log("voting proposal")
    await gov.castVote(4, 1).then(mineBlock)
    await advanceBlockHeight(voteBlocks);
    console.log("queue proposal")
    await gov.queue(4).then(mineBlock);
    await fastForward(timelockDelay);
    console.log("execute proposal")
    await gov.execute(4).then(mineBlock);
  });
});
