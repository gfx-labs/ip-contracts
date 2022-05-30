import { s } from "./scope";
import { ethers, network, tenderly } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear, reset } from "../../util/block";
import { stealMoney } from "../../util/money";

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

let usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";

describe("Token Setup", () => {
    it("connect to signers", async () => {
        let accounts = await ethers.getSigners();
        s.Frank = accounts[0];
        s.Eric = accounts[5];
        s.Andy = accounts[6];
        s.Bob = accounts[7];
    });
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank);
    });
    it("Should succesfully transfer money", async () => {
        showBody(`stealing ${s.Frank_USDC} to andy from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, "0x70bDA08DBe07363968e9EE53d899dFE48560605B", s.usdcAddress, s.Frank_USDC)
        ).to.not.be.reverted;
        await mineBlock();
    });
});

import { DeployContract, DeployContractWithProxy } from "../../util/deploy";

const deployGovAndToken = async () => {
    let txCount = await s.Frank.getTransactionCount()
    //console.log("tx count: "+txCount)
    const futureAddressOne = ethers.utils.getContractAddress({from:s.Frank.address ,nonce: txCount})
    //address one is the token delegate
    //console.log("futureAddressOne: "+futureAddressOne)
    const futureAddressTwo = ethers.utils.getContractAddress({from:s.Frank.address,nonce: txCount+1})
    //address two is the token delegator
    //console.log("futureAddressTwo: "+futureAddressTwo)
    const futureAddressThree = ethers.utils.getContractAddress({from:s.Frank.address,nonce: txCount+2})
    //address three is the gov delegate
    //console.log("futureAddressThree: "+futureAddressThree)
    const futureAddressFour = ethers.utils.getContractAddress({from:s.Frank.address,nonce: txCount+3})
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

require('chai').should()
describe("Governance & IPT Contracts", () => {
    before(async () => {
        await deployGovAndToken()
        showBody("ipt_", await s.GOV.ipt())
        showBody("votingPeriod_", await s.GOV.votingPeriod())
        showBody("votingDelay_", await s.GOV.votingDelay())
        showBody("proposalThreshold_", await s.GOV.proposalThreshold())
        showBody("proposalTimelockDelay_", await s.GOV.proposalTimelockDelay())
        showBody("quorumVotes_", await s.GOV.quorumVotes())
        showBody("emergencyQuorumVotes_", await s.GOV.emergencyQuorumVotes())
        showBody("emergencyVotingPeriod_", await s.GOV.emergencyVotingPeriod())
        showBody("emergencyTimelockDelay_", await s.GOV.emergencyTimelockDelay())
        showBody("proposalCount ", await s.GOV.proposalCount())
    })
    it("Verify owner of governance is IPT", async () => {
        expect(await s.GOV.ipt()).to.equal(await s.InterestProtocolToken.address);
    })
    it("Verify gov token admin is gov", async () => {
        showBody("GOV owner", await s.GOV.address)
        showBody("IPT owner", await s.IPT.owner())
        expect(await s.GOV.address).to.equal(await s.IPT.owner());
    })
    it("Verify gov token admin is gov", async () => {
        showBody("GOV owner", await s.GOV.address)
        showBody("IPT owner", await s.IPT.owner())
        expect(await s.GOV.address).to.equal(await s.IPT.owner());
    })
    it("Verify Frank can't make a proposal", async () => {
        //should check that the start & end blocks are as expected
        const targets = [s.USDC.address]
        const values = ["0"]
        const signatures = ["transfer(address,uint256)"]
        const calldatas = ["0x00000000000000000000000002a3037749fa094d7f2e206f70c0eb5fc4004c1c0000000000000000000000000000000000000000000000000000000005f5e100"]
        const description = "test proposal"
        const emergency = false
        await expect(s.GOV.propose(targets,values,signatures,calldatas,description,emergency)).to.be.revertedWith('votes below proposal threshold')
    })
    it("Verify Frank delegated votes to himself", async () => {
        let bn = await ethers.provider.getBlockNumber();
        showBody("Frank's votes", await s.IPT.getCurrentVotes(s.Frank.address))
        await s.IPT.connect(s.Frank).delegate(s.Frank.address)
        await mineBlock()
        showBody("Frank's votes", await s.IPT.getCurrentVotes(s.Frank.address))
        expect(await s.IPT.getCurrentVotes(s.Frank.address)).to.be.gt(0)
        expect(await s.IPT.getPriorVotes(s.Frank.address,bn)).to.eq(0)        
    })
    it("Verify Frank can make a proposal", async () => {
        const targets = [s.USDC.address]
        const values = ["0"]
        const signatures = ["transfer(address,uint256)"]
        const calldatas = ["0x00000000000000000000000002a3037749fa094d7f2e206f70c0eb5fc4004c1c0000000000000000000000000000000000000000000000000000000005f5e100"]
        const description = "test proposal"
        const emergency = false
        await mineBlock()
        showBody("proposal count",await s.GOV.proposalCount())
        await s.GOV.propose(targets,values,signatures,calldatas,description,emergency)
        await mineBlock()
        showBody("proposal count",await s.GOV.proposalCount())
        expect (await s.GOV.proposalCount()).to.be.gt(0)
    })

    it("Verify Frank can't vote bc review period", async () => {
        let bn = await ethers.provider.getBlockNumber();
        showBody("currentBlockNumber: ", bn)
        const proposalId = await s.GOV.proposalCount()
        let proposalInfo = await s.GOV.proposals(proposalId);
        showBody("start block",proposalInfo['startBlock'])
        showBody("before vote",proposalInfo['forVotes'])
        const support = 1
        const reason = "good proposal"
        await expect(s.GOV.castVoteWithReason(proposalId, support, reason)).to.be.reverted
    })

    it("Verify Frank can vote after the review period", async () => {
        await advanceBlockHeight((await s.GOV.votingDelay()).toNumber())
        let bn = await ethers.provider.getBlockNumber();
        showBody("currentBlockNumber: ", bn)
        const proposalId = await s.GOV.proposalCount()
        let proposalInfo = await s.GOV.proposals(proposalId);
        showBody("start block",proposalInfo['startBlock'])
        showBody("before vote",proposalInfo['forVotes'])
        const support = 1
        const reason = "good proposal"
        await s.GOV.castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        proposalInfo = await s.GOV.proposals(proposalId);
        showBody("after vote",proposalInfo['forVotes'])
    })

    it("Verify Frank can't queue the proposal", async () => {
        const proposalId = await s.GOV.proposalCount()
        showBody("proposal count", proposalId)
        await expect(s.GOV.queue(proposalId)).to.be.reverted
    })
    
    it("Verify Frank can queue the proposal", async () => {
        await advanceBlockHeight((await s.GOV.votingPeriod()).toNumber())
        const proposalId = await s.GOV.proposalCount()
        await s.GOV.queue(proposalId)
        await mineBlock()
        let state = await s.GOV.state(proposalId);
        showBody("state: ", state)
        await expect(state).to.equal(5)
    })

    it("Verify Frank can't exeucte the proposal", async () => {
        const proposalId = await s.GOV.proposalCount()
        await expect(s.GOV.execute(proposalId)).to.be.reverted
    })

    it("Verify Frank can exeucte the proposal", async () => {
        await fastForward((await s.GOV.proposalTimelockDelay()).toNumber())
        let startingBalance = await s.USDC.balanceOf(s.GOV.address)
        const proposalId = await s.GOV.proposalCount()
        await s.GOV.execute(proposalId)
        await mineBlock()
        let endingBalance = await s.USDC.balanceOf(s.GOV.address)
        expect(startingBalance).to.be.gt(endingBalance)
    })
    it("Verify Frank can transfer IPT to Eric", async () => {
        let startingBalance = await s.IPT.balanceOf(s.Eric.address)
        await s.IPT.transfer(s.Eric.address,"250000000000000000000000")
        await mineBlock()
        let endingBalance = await s.IPT.balanceOf(s.Eric.address)
        expect(endingBalance).to.be.gt(startingBalance)
    })
    it("Verify Eric can delegate to Andy", async () => {
        await s.IPT.connect(s.Eric).delegate(s.Andy.address)
        await mineBlock()
        expect(await s.IPT.getCurrentVotes(s.Andy.address)).to.be.gt(0)
    })
    it("Verify Andy can make an emergency proposal", async () => {
        const targets = [s.USDC.address]
        const values = ["0"]
        const signatures = ["transfer(address,uint256)"]
        const calldatas = ["0x00000000000000000000000002a3037749fa094d7f2e206f70c0eb5fc4004c1c0000000000000000000000000000000000000000000000000000000005f5e100"]
        const description = "test proposal"
        const emergency = true
        await s.GOV.connect(s.Andy).propose(targets,values,signatures,calldatas,description,emergency)
        await mineBlock()
        const proposalId = await s.GOV.proposalCount()
        let proposalInfo = await s.GOV.proposals(proposalId);
        let bn = await ethers.provider.getBlockNumber();
        showBody("currentBlockNumber: ", bn)
        showBody("start block: ",proposalInfo['startBlock'])
        showBody("end vote: ",proposalInfo['endBlock'])
        expect (proposalId).to.be.gt(1)
    })
    it("Verify Andy can immediately vote", async () => {
        const proposalId = await s.GOV.proposalCount()
        const support = 1
        const reason = "good proposal"
        await s.GOV.connect(s.Andy).castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        let proposalInfo = await s.GOV.proposals(proposalId);
        let newVotes = proposalInfo['forVotes']
        showBody("newVotes: ", newVotes)
        expect(newVotes).to.be.gt(0)
    })
    //a proposal can fail for two reasons: not enough votes or not enough time
    it("Verify Frank can't queue the proposal bc time", async () => {
        const proposalId = await s.GOV.proposalCount()
        showBody("proposal count", proposalId)
        await expect(s.GOV.connect(s.Andy).queue(proposalId)).to.be.revertedWith("can only be queued if succeeded")
        
    })
    it("Verify Frank can't queue the proposal bc votes", async () => {
        await advanceBlockHeight((await s.GOV.emergencyVotingPeriod()).toNumber())
        const proposalId = await s.GOV.proposalCount()
        showBody("proposal count", proposalId)
        await expect(s.GOV.connect(s.Andy).queue(proposalId)).to.be.revertedWith("can only be queued if succeeded")
    })
    it("Verify emergency proposals work", async () => {
        await mineBlock()
        const targets = [s.USDC.address]
        const values = ["0"]
        const signatures = ["transfer(address,uint256)"]
        const calldatas = ["0x00000000000000000000000002a3037749fa094d7f2e206f70c0eb5fc4004c1c0000000000000000000000000000000000000000000000000000000005f5e100"]
        const description = "test proposal"
        const emergency = true
        await s.GOV.connect(s.Andy).propose(targets,values,signatures,calldatas,description,emergency)
        await mineBlock()
        const proposalId = await s.GOV.proposalCount()
        let proposalInfo = await s.GOV.proposals(proposalId)
        let bn = await ethers.provider.getBlockNumber()
        let bnData = await ethers.provider.getBlock(bn)
        //showBody("time at propose: ", bnData.timestamp)
        showBody("currentBlockNumber: ", bn)
        showBody("start block: ",proposalInfo['startBlock'])
        showBody("end vote: ",proposalInfo['endBlock'])
        expect (proposalId).to.be.gt(2)
        const support = 1
        const reason = "good proposal"
        await s.GOV.connect(s.Andy).castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        proposalInfo = await s.GOV.proposals(proposalId);
        let newVotes = proposalInfo['forVotes']
        showBody("newVotes: ", newVotes)
        expect(newVotes).to.be.gt(0)
        await s.GOV.castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        await advanceBlockHeight((await s.GOV.emergencyVotingPeriod()).toNumber())
        bn = await ethers.provider.getBlockNumber()
        bnData = await ethers.provider.getBlock(bn)
        showBody("before queue time: ", bnData.timestamp)
        showBody("expected eta: ", proposalInfo['delay'].add(bnData.timestamp))
        await s.GOV.connect(s.Andy).queue(proposalId)
        await mineBlock()
        await fastForward((await s.GOV.emergencyTimelockDelay()).toNumber())
        let startingBalance = await s.USDC.balanceOf(s.GOV.address)
        await mineBlock()
        bn = await ethers.provider.getBlockNumber()
        bnData = await ethers.provider.getBlock(bn)
        showBody("time at execute: ", bnData.timestamp)
        proposalInfo = await s.GOV.proposals(proposalId);
        showBody("eta: ", proposalInfo['eta'])
        await s.GOV.execute(proposalId)
        await mineBlock()
        let endingBalance = await s.USDC.balanceOf(s.GOV.address)
        expect(startingBalance).to.be.gt(endingBalance)
    })
    it("Verify parameters update as expected", async () => {
        await mineBlock()
        const targets = [
            s.GOV.address,
            s.GOV.address,
            s.GOV.address,
            s.GOV.address,
            s.GOV.address,
            s.GOV.address,
            s.GOV.address,
            s.GOV.address,
            s.GOV.address,
            s.GOV.address
        ]
        const values = ["0","0","0","0","0","0","0","0","0","0"]
        const signatures = [
            "_setDelay(uint256)",
            "_setEmergencyDelay(uint256)",
            "_setVotingDelay(uint256)",
            "_setVotingPeriod(uint256)",
            "_setEmergencyVotingPeriod(uint256)",
            "_setProposalThreshold(uint256)",
            "_setQuorumVotes(uint256)",
            "_setEmergencyQuorumVotes(uint256)",
            "_setWhitelistGuardian(address)",
            "_setWhitelistAccountExpiration(address,uint256)"
        ]
            
        const calldatas = [
            "0x0000000000000000000000000000000000000000000000000000000000030D40",
            "0x00000000000000000000000000000000000000000000000000000000000186A0",
            "0x0000000000000000000000000000000000000000000000000000000000004E20",
            "0x0000000000000000000000000000000000000000000000000000000000004E20",
            "0x0000000000000000000000000000000000000000000000000000000000004E20",
            "0x000000000000000000000000000000000000000000002A5A058FC295ED000000",
            "0x0000000000000000000000000000000000000000001232AE63C59C6BD6000000",
            "0x000000000000000000000000000000000000000000108B2A2C28029094000000",
            "0x0000000000000000000000009965507D1a55bcC2695C58ba16FB37d819B0A4dc",
            "0x00000000000000000000000014dC79964da2C08b23698B3D3cc7Ca32193d9955000000000000000000000000000000000000000000000000000000006553f100"
        ]
        const description = "test proposal"
        const emergency = false
        showBody("proposal count: ", await s.GOV.proposalCount())
        await s.GOV.connect(s.Andy).propose(targets,values,signatures,calldatas,description,emergency)
        await mineBlock()
        const proposalId = await s.GOV.proposalCount()
        showBody("proposal count: ", proposalId)
        let proposalInfo = await s.GOV.proposals(proposalId)
        expect (proposalId).to.be.gt(3)
        const support = 1
        const reason = "good proposal"
        await advanceBlockHeight((await s.GOV.votingDelay()).toNumber())
        await s.GOV.connect(s.Andy).castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        proposalInfo = await s.GOV.proposals(proposalId);
        await s.GOV.castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        await advanceBlockHeight((await s.GOV.votingPeriod()).toNumber())
        await s.GOV.connect(s.Andy).queue(proposalId)
        await mineBlock()
        await fastForward((await s.GOV.proposalTimelockDelay()).toNumber())
        await mineBlock()
        await s.GOV.connect(s.Andy).execute(proposalId)
        await mineBlock()
        showBody("proposalTimelockDelay_", await s.GOV.proposalTimelockDelay())
        showBody("emergencyTimelockDelay_", await s.GOV.emergencyTimelockDelay())
        showBody("votingDelay_", await s.GOV.votingDelay())
        showBody("votingPeriod_", await s.GOV.votingPeriod())
        showBody("emergencyVotingPeriod_", await s.GOV.emergencyVotingPeriod())
        showBody("proposalThreshold_", await s.GOV.proposalThreshold())
        showBody("quorumVotes_", await s.GOV.quorumVotes())
        showBody("emergencyQuorumVotes_", await s.GOV.emergencyQuorumVotes())
        showBody("is whitelisted?: ", await s.GOV.isWhitelisted(s.Eric.address))
        showBody("is whitelistGuardian: ", await s.GOV.whitelistGuardian());
        expect (await s.GOV.isWhitelisted(s.Bob.address)).to.eq(true)
    })
    it("Verify proposer can cancel", async () => {
        await mineBlock()
        const targets = [s.GOV.address]
        const values = ["0"]
        const signatures = ["transfer(address,uint256)"]
        const calldatas = ["0x00000000000000000000000002a3037749fa094d7f2e206f70c0eb5fc4004c1c0000000000000000000000000000000000000000000000000000000005f5e100"]
        const description = "test proposal"
        const emergency = false
        showBody("proposal count: ", await s.GOV.proposalCount())
        await s.GOV.connect(s.Andy).propose(targets,values,signatures,calldatas,description,emergency)
        await mineBlock()
        const proposalId = await s.GOV.proposalCount()
        showBody("proposal count: ", proposalId)
        let proposalInfo = await s.GOV.proposals(proposalId)
        expect (proposalId).to.be.gt(4)
        const support = 1
        const reason = "good proposal"
        await advanceBlockHeight((await s.GOV.votingDelay()).toNumber())
        await s.GOV.connect(s.Andy).castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        await s.GOV.connect(s.Andy).cancel(proposalId)
        await mineBlock()
        await expect (s.GOV.castVoteWithReason(proposalId, support, reason)).to.be.reverted
    })
    it("Verify cancel works on if votes are rugged", async () => {
        await mineBlock()
        const targets = [s.GOV.address]
        const values = ["0"]
        const signatures = ["transfer(address,uint256)"]
        const calldatas = ["0x00000000000000000000000002a3037749fa094d7f2e206f70c0eb5fc4004c1c0000000000000000000000000000000000000000000000000000000005f5e100"]
        const description = "test proposal"
        const emergency = false
        showBody("proposal count: ", await s.GOV.proposalCount())
        await s.GOV.connect(s.Andy).propose(targets,values,signatures,calldatas,description,emergency)
        await mineBlock()
        const proposalId = await s.GOV.proposalCount()
        showBody("proposal count: ", proposalId)
        expect (proposalId).to.be.gt(5)
        const support = 1
        const reason = "good proposal"
        await advanceBlockHeight((await s.GOV.votingDelay()).toNumber())
        await s.GOV.connect(s.Andy).castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        await s.IPT.connect(s.Eric).delegate(s.Eric.address)
        await mineBlock()
        await s.GOV.connect(s.Eric).cancel(proposalId)
        await mineBlock()
        await expect (s.GOV.castVoteWithReason(proposalId, support, reason)).to.be.reverted
    })
    it("Verify whitelisted address can make a proposal & IPT onlyOwner functions work", async () => {
        await mineBlock()
        showBody("name: ", await s.IPT.name())
        showBody("symbol: ", await s.IPT.symbol())
        showBody("bob's ipt balance: ", await s.IPT.balanceOf(s.Bob.address))
        const targets = [s.IPT.address, s.IPT.address, s.IPT.address]
        const values = ["0","0","0"]
        const signatures = ["changeName(string)","changeSymbol(string)","mint(address,uint256)"]
        const calldatas = [
            "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d4761746577617920546f6b656e00000000000000000000000000000000000000",
            "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000024754000000000000000000000000000000000000000000000000000000000000",
            "0x00000000000000000000000014dc79964da2c08b23698b3d3cc7ca32193d99550000000000000000000000000000000000000000000000056bc75e2d63100000"
        ]
        const description = "test proposal"
        const emergency = false
        showBody("proposal count: ", await s.GOV.proposalCount())
        await s.GOV.connect(s.Bob).propose(targets,values,signatures,calldatas,description,emergency)
        await mineBlock()
        const proposalId = await s.GOV.proposalCount()
        showBody("proposal count: ", proposalId)
        let proposalInfo = await s.GOV.proposals(proposalId)
        expect (proposalId).to.be.gt(6)
        const support = 1
        const reason = "good proposal"
        await advanceBlockHeight((await s.GOV.votingDelay()).toNumber())
        await s.GOV.connect(s.Andy).castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        proposalInfo = await s.GOV.proposals(proposalId);
        await s.GOV.castVoteWithReason(proposalId, support, reason)
        await mineBlock()
        await advanceBlockHeight((await s.GOV.votingPeriod()).toNumber())
        await mineBlock()
        await s.GOV.connect(s.Andy).queue(proposalId)
        await mineBlock()
        await fastForward((await s.GOV.proposalTimelockDelay()).toNumber())
        await mineBlock()
        await s.GOV.execute(proposalId)
        await mineBlock()
        //showBody("name: ", await s.IPT.name())
        //showBody("symbol: ", await s.IPT.symbol())
        //showBody("bob's ipt balance: ", await s.IPT.balanceOf(s.Bob.address))
        expect (await s.IPT.name()).to.eq("Gateway Token")
        expect (await s.IPT.symbol()).to.eq("GT")
        expect (await s.IPT.balanceOf(s.Bob.address)).to.be.gt(0)
    })
    it("allowance/transferFrom", async () => {
        showBody("bob's allowance: ", await s.IPT.allowance(s.Bob.address, s.Eric.address))
        showBody("andy's balance: ", await s.IPT.balanceOf(s.Andy.address))
        await s.IPT.connect(s.Bob).approve(s.Eric.address,BN("1e28"))
        await mineBlock()
        showBody("bob's allowance", await s.IPT.allowance(s.Bob.address, s.Eric.address))
        await s.IPT.connect(s.Eric).transferFrom(s.Bob.address,s.Andy.address,BN("1e18"))
        await mineBlock()
        showBody("andy's balance: ", await s.IPT.balanceOf(s.Andy.address))
    })
})

// permit and delegateBySig not testing here