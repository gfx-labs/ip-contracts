import { s } from ".././scope";
import { ethers, network, tenderly } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { getArgs } from "../../../util/math"
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
    reset,
    currentBlock,
} from "../../../util/block";
import { stealMoney } from "../../../util/money";

import {
    InterestProtocolTokenDelegate,
    InterestProtocolTokenDelegate__factory,
    InterestProtocolToken,
    InterestProtocolToken__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    GovernorCharlieDelegator,
    GovernorCharlieDelegator__factory,
    IERC20__factory,
} from "../../../typechain-types";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { toNumber } from "../../../util/math";
require("chai").should();
describe("Testing Optimistic proposals", () => {

    it("Set up starting values & whitelist Bob to make optimistic proposals", async () => {
        await mineBlock();
        const targets = [
            s.GOV.address
        ];
        const values = ["0"];
        const signatures = [
            "_setWhitelistAccountExpiration(address,uint256)",
        ];
        const calldatas = [
            "0x00000000000000000000000014dC79964da2C08b23698B3D3cc7Ca32193d99550000000000000000000000000000000000000000000000000000000062F19700",
        ];
        const description = "test proposal";
        const emergency = false;
        let proposalCount = await s.GOV.proposalCount();
        await s.GOV.connect(s.Andy).propose(
            targets,
            values,
            signatures,
            calldatas,
            description,
            emergency
        );
        await mineBlock();
        const proposalId = await s.GOV.proposalCount();
        expect(proposalId).to.be.eq(proposalCount.add(1));
        let proposalInfo = await s.GOV.proposals(proposalId);
        expect(proposalId).to.be.at.least(2);
        const support = 1;
        const reason = "good proposal";
        await advanceBlockHeight((await s.GOV.votingDelay()).toNumber());
        await s.GOV.connect(s.Andy).castVoteWithReason(proposalId, support, reason);
        await mineBlock();
        proposalInfo = await s.GOV.proposals(proposalId);
        await s.GOV.castVoteWithReason(proposalId, support, reason);
        await mineBlock();
        await advanceBlockHeight((await s.GOV.votingPeriod()).toNumber());
        await s.GOV.connect(s.Andy).queue(proposalId);
        await mineBlock();
        await fastForward((await s.GOV.proposalTimelockDelay()).toNumber());
        await mineBlock();
        await s.GOV.connect(s.Andy).execute(proposalId);
        await mineBlock();


        expect(await s.GOV.isWhitelisted(s.Bob.address)).to.eq(true, "Bob is now whitelisted");
    })
    it("Bob can only make optimistic proposals", async () => {

        const targets = [
            s.GOV.address
        ];
        const values = ["0"];
        const signatures = [
            "_setWhitelistAccountExpiration(address,uint256)",
        ];
        //Eric's address
        const calldatas = [
            "0x0000000000000000000000009965507D1a55bcC2695C58ba16FB37d819B0A4dc000000000000000000000000000000000000000000000000000000006553f100",
        ];
        const description = "Whitelist Eric";

        //even if Bob makes a proposal with emergency set to true, it still makes a normal optimistic proposal as expected
        const emergency = true;


        //predict start and end blocks for optimistic proposal
        let block:any = await currentBlock()
        block = block.number + 1 //add 1 as we want the next block that contains the proposal
        let expectedStart = block + (await (await s.GOV.optimisticVotingDelay()).toNumber())
        let standardStart  = block + await (await s.GOV.votingDelay()).toNumber()
        let expectedEnd = expectedStart + (await (await s.GOV.votingPeriod()).toNumber())
        let standardEnd = block + await (await s.GOV.votingDelay()).toNumber() + await (await s.GOV.votingPeriod()).toNumber()

        let emergencyEnd = block + await (await s.GOV.emergencyVotingPeriod()).toNumber()


        //We have already confirmed that Bob is on the whitelist
        const result = await s.GOV.connect(s.Bob).propose(
            targets,
            values,
            signatures,
            calldatas,
            description,
            emergency
        );
        await mineBlock()
        const proposalId = await s.GOV.proposalCount();
        const args = await getArgs(result)
        expect(args.description).to.eq(description, "Description is correct on event receipt")
        expect(args.id).to.eq(proposalId, "Proposal ID is correct on event receipt")

        //confirm proposal matches expectations for optimistic, and does not match expectations for standard or emergency proposal
        const proposalInfo = await s.GOV.proposals(proposalId)
        expect(proposalInfo.quorumVotes).to.eq(await s.GOV.optimisticQuorumVotes(), "Proposal correctly has optimistic quorumVotes")
        expect(proposalInfo.quorumVotes).to.not.eq(await s.GOV.quorumVotes(), "Proposal correctly does not have standard quorumVotes")
        expect(proposalInfo.quorumVotes).to.not.eq(await s.GOV.emergencyQuorumVotes(), "Proposal correctly does not have emergency quorumVotes")


        assert.equal(proposalInfo.startBlock, expectedStart, "Start block is correct for optimistic proposal")
        assert.equal(proposalInfo.endBlock, expectedEnd, "End block is correct for optimistic proposal")

        expect(proposalInfo.startBlock).to.not.eq(standardStart, "Proposal correctly does not have standard start block")
        expect(proposalInfo.endBlock).to.not.eq(standardEnd, "Proposal correctly does not have standard end block")

        expect(proposalInfo.startBlock).to.not.eq(block, "Proposal correctly does not have emergency start block")
        expect(proposalInfo.endBlock).to.not.eq(emergencyEnd, "Proposal correctly does not have emergency end block")

        expect(proposalInfo.delay).to.eq(await s.GOV.proposalTimelockDelay(), "Proposal correctly has standard time lock delay")
        expect(proposalInfo.delay).to.not.eq(await s.GOV.emergencyTimelockDelay(), "Proposal correctly does not have emergency time lock delay")

        //queue and execute
    })
});