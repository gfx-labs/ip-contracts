import { s } from "../scope";
import { ethers, network, tenderly } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear, reset } from "../../../util/block";
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
    IERC20__factory
} from "../../../typechain-types";

import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";

const deployGovAndToken = async () => {
    let txCount = await s.Frank.getTransactionCount()
    //console.log("tx count: "+txCount)
    const futureAddressOne = ethers.utils.getContractAddress({ from: s.Frank.address, nonce: txCount })
    //address one is the token delegate
    //console.log("futureAddressOne: "+futureAddressOne)
    const futureAddressTwo = ethers.utils.getContractAddress({ from: s.Frank.address, nonce: txCount + 1 })
    //address two is the token delegator
    //console.log("futureAddressTwo: "+futureAddressTwo)
    const futureAddressThree = ethers.utils.getContractAddress({ from: s.Frank.address, nonce: txCount + 2 })
    //address three is the gov delegate
    //console.log("futureAddressThree: "+futureAddressThree)
    const futureAddressFour = ethers.utils.getContractAddress({ from: s.Frank.address, nonce: txCount + 3 })
    //address three is the gov delegator
    //console.log("futureAddressFour: "+futureAddressFour)

    const ipt_ = futureAddressTwo;
    const Govimplementation_ = futureAddressThree;
    const votingPeriod_ = BN("19710")
    const votingDelay_ = BN("13140")
    const proposalThreshold_ = BN("250000000000000000000000")
    const proposalTimelockDelay_ = BN("172800")
    const quorumVotes_ = BN("50000000000000000000000000")
    const emergencyQuorumVotes_ = BN("50000000000000000000000000")
    const emergencyVotingPeriod_ = BN("6570")
    const emergencyTimelockDelay_ = BN("86400")

    s.InterestProtocolTokenDelegate = await DeployContract(new InterestProtocolTokenDelegate__factory(s.Frank), s.Frank)

    const totalSupplyReceiver_ = s.Frank.address;
    const owner_ = futureAddressFour
    const TokenImplementation_ = s.InterestProtocolTokenDelegate.address
    const totalSupply_ = BN("1e26")

    await mineBlock()
    s.InterestProtocolToken = await DeployContract(
        new InterestProtocolToken__factory(s.Frank),
        s.Frank,
        totalSupplyReceiver_,
        owner_,
        TokenImplementation_,
        totalSupply_
    )
    await mineBlock()
    let owner = await s.InterestProtocolToken.owner()
    showBody("OWNER: ", owner)
    s.GovernorCharlieDelegate = await DeployContract(new GovernorCharlieDelegate__factory(s.Frank), s.Frank)
    await mineBlock()
    s.GovernorCharlieDelegator = await DeployContract(
        new GovernorCharlieDelegator__factory(s.Frank),
        s.Frank,
        ipt_,  //ipt
        Govimplementation_,
        votingPeriod_,
        votingDelay_,
        proposalThreshold_,
        proposalTimelockDelay_,
        quorumVotes_,
        emergencyQuorumVotes_,
        emergencyVotingPeriod_,
        emergencyTimelockDelay_
    )
    await mineBlock()
    s.GOV = GovernorCharlieDelegate__factory.connect(s.GovernorCharlieDelegator.address, s.Frank);
    s.IPT = InterestProtocolTokenDelegate__factory.connect(s.InterestProtocolToken.address, s.Frank);
    let govToken = await s.GOV.ipt()
    showBody("IPT token: ", govToken)
}

describe("Deploy gov and token", () => {
    it("deploys gov and token", async () => {
        await deployGovAndToken()
    })
})