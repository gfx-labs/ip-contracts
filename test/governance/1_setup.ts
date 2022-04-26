import { s } from "./scope";
import { ethers, network, tenderly } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear, reset } from "../../util/block";

import {
    InterestProtocolTokenDelegate,
    InterestProtocolTokenDelegate__factory,
    InterestProtocolToken,
    InterestProtocolToken__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    GovernorCharlieDelegator,
    GovernorCharlieDelegator__factory,
} from "../../typechain-types";

describe("hardhat settings", () => {
    it("reset hardhat network each run", async () => {
        expect(await reset(0)).to.not.throw;
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [false])).to.not
            .throw;
    });

});

describe("Token Setup", () => {
    it("connect to signers", async () => {
        let accounts = await ethers.getSigners();
        s.Frank = accounts[0];
    });
});

import { DeployContract, DeployContractWithProxy } from "../../util/deploy";

const deployGovAndToken = async () => {
    let txCount = await s.Frank.getTransactionCount()
    console.log("tx count: "+txCount)
    const futureAddressOne = ethers.utils.getContractAddress({from:s.Frank.address ,nonce: txCount})
    //address one is the token delegate
    console.log("futureAddressOne: "+futureAddressOne)
    const futureAddressTwo = ethers.utils.getContractAddress({from:s.Frank.address,nonce: txCount+1})
    //address two is the token delegator
    console.log("futureAddressTwo: "+futureAddressTwo)
    const futureAddressThree = ethers.utils.getContractAddress({from:s.Frank.address,nonce: txCount+2})
    //address three is the gov delegate
    console.log("futureAddressThree: "+futureAddressThree)
    const futureAddressFour = ethers.utils.getContractAddress({from:s.Frank.address,nonce: txCount+3})
    //address three is the gov delegator
    console.log("futureAddressFour: "+futureAddressFour)    

    s.InterestProtocolTokenDelegate = await DeployContract(new InterestProtocolTokenDelegate__factory(s.Frank), s.Frank) 
    console.log("test 1")
    await mineBlock()    
    s.InterestProtocolToken = await DeployContract(
        new InterestProtocolToken__factory(s.Frank),
        s.Frank,
        s.Frank.address,
        futureAddressFour,
        s.InterestProtocolTokenDelegate.address,
        BN("1e26")
    )
    console.log("test 2")
    await mineBlock()
    let owner = await s.InterestProtocolToken.owner()
    showBody("OWNER: ", owner)
    s.GovernorCharlieDelegate = await DeployContract(new GovernorCharlieDelegate__factory(s.Frank), s.Frank)
    console.log("test 3")
    await mineBlock()
    s.GovernorCharlieDelegator = await DeployContract(
        new GovernorCharlieDelegator__factory(s.Frank),
        s.Frank,
        futureAddressTwo,  //ipt
        futureAddressThree, //implementation_
        BN("19710"), //votingPeriod_
        BN("13140"), //votingDelay_
        BN("250000000000000000000000"), //proposalThreshold_
        BN("172800"), //proposalTimelockDelay_
        BN("5000000000000000000000000"), //quorumVotes_
        BN("50000000000000000000000000"), //emergencyQuorumVotes_
        BN("6570"), //emergencyVotingPeriod_
        BN("86400")
    )
    console.log("test 4")
    await mineBlock()
    s.GOV = GovernorCharlieDelegate__factory.connect(s.GovernorCharlieDelegator.address, s.Frank);
    let govToken = await s.GOV.ipt()
    showBody("govToken: ", govToken)

}

require('chai').should()
describe("Deploy Contracts", () => {
    before(async () => {
        await deployGovAndToken()
    })
    it("Verify gov token admin is gov", async () => {
        const govTokenOnGovContract = await s.GOV.ipt();
        const currentGovToken = await s.InterestProtocolToken.address;
        expect(govTokenOnGovContract).to.equal(currentGovToken);
    })
    
})
