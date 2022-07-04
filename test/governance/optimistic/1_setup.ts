import { s } from ".././scope";
import { ethers, network, tenderly } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  reset,
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
    //showBody(`stealing ${s.Frank_USDC} to andy from ${s.usdcAddress}`);
    await expect(
      stealMoney(
        usdc_minter,
        "0x70bDA08DBe07363968e9EE53d899dFE48560605B",
        s.usdcAddress,
        s.Frank_USDC
      )
    ).to.not.be.reverted;
    await mineBlock();
  });
});

import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { toNumber } from "../../../util/math";

const deployGovAndToken = async () => {
  let txCount = await s.Frank.getTransactionCount();
  //console.log("tx count: "+txCount)
  const futureAddressOne = ethers.utils.getContractAddress({
    from: s.Frank.address,
    nonce: txCount,
  });
  //address one is the token delegate
  //console.log("futureAddressOne: "+futureAddressOne)
  const futureAddressTwo = ethers.utils.getContractAddress({
    from: s.Frank.address,
    nonce: txCount + 1,
  });
  //address two is the token delegator
  //console.log("futureAddressTwo: "+futureAddressTwo)
  const futureAddressThree = ethers.utils.getContractAddress({
    from: s.Frank.address,
    nonce: txCount + 2,
  });
  //address three is the gov delegate
  //console.log("futureAddressThree: "+futureAddressThree)
  const futureAddressFour = ethers.utils.getContractAddress({
    from: s.Frank.address,
    nonce: txCount + 3,
  });
  //address three is the gov delegator
  //console.log("futureAddressFour: "+futureAddressFour)

  const ipt_ = futureAddressTwo;
  const Govimplementation_ = futureAddressThree;

  s.InterestProtocolTokenDelegate = await DeployContract(
    new InterestProtocolTokenDelegate__factory(s.Frank),
    s.Frank
  );
  const totalSupplyReceiver_ = s.Frank.address;
  const owner_ = futureAddressFour;
  const TokenImplementation_ = s.InterestProtocolTokenDelegate.address;
  const totalSupply_ = BN("1e26");

  await mineBlock();
  s.InterestProtocolToken = await DeployContract(
    new InterestProtocolToken__factory(s.Frank),
    s.Frank,
    totalSupplyReceiver_,
    owner_,
    TokenImplementation_,
    totalSupply_
  );
  await mineBlock();
  let owner = await s.InterestProtocolToken.owner();
  s.GovernorCharlieDelegate = await DeployContract(
    new GovernorCharlieDelegate__factory(s.Frank),
    s.Frank
  );
  await mineBlock();
  s.GovernorCharlieDelegator = await DeployContract(
    new GovernorCharlieDelegator__factory(s.Frank),
    s.Frank,
    s.InterestProtocolToken.address, //ipt
    Govimplementation_,
  );
  await mineBlock();
  s.GOV = GovernorCharlieDelegate__factory.connect(
    s.GovernorCharlieDelegator.address,
    s.Frank
  );
  s.IPT = InterestProtocolTokenDelegate__factory.connect(
    s.InterestProtocolToken.address,
    s.Frank
  );
};

describe("Deploy and verify", () => {
  before(async () => {
    await deployGovAndToken();
  });
  it("Verify owner of governance is IPT", async () => {
    expect(await s.GOV.ipt()).to.equal(s.InterestProtocolToken.address);
  });
  it("Verify gov token admin is gov", async () => {
    //showBody("GOV owner", await s.GOV.address)
    //showBody("IPT owner", await s.IPT.owner())
    expect(s.GOV.address).to.equal(await s.IPT.owner());
  });
  it("Verify gov token admin is gov", async () => {
    //showBody("GOV owner", await s.GOV.address)
    //showBody("IPT owner", await s.IPT.owner())
    expect(s.GOV.address).to.equal(await s.IPT.owner());
  });
  it("Verify Frank can't make a proposal", async () => {
    //should check that the start & end blocks are as expected
    const targets = [s.USDC.address];
    const values = ["0"];
    const signatures = ["transfer(address,uint256)"];
    const calldatas = [
      "0x00000000000000000000000002a3037749fa094d7f2e206f70c0eb5fc4004c1c0000000000000000000000000000000000000000000000000000000005f5e100",
    ];
    const description = "test proposal";
    const emergency = false;
    await expect(
      s.GOV.propose(
        targets,
        values,
        signatures,
        calldatas,
        description,
        emergency
      )
    ).to.be.revertedWith("votes below proposal threshold");
  });
  it("Verify Frank delegated votes to himself", async () => {
    let bn = await ethers.provider.getBlockNumber();
    //showBody("Frank's votes", await s.IPT.getCurrentVotes(s.Frank.address))
    await s.IPT.connect(s.Frank).delegate(s.Frank.address);
    await mineBlock();
    //showBody("Frank's votes", await s.IPT.getCurrentVotes(s.Frank.address))
    expect(await s.IPT.getCurrentVotes(s.Frank.address)).to.be.gt(0);
    expect(await s.IPT.getPriorVotes(s.Frank.address, bn)).to.eq(0);
  });
  it("Verify Frank can make a proposal", async () => {
    const targets = [s.USDC.address];
    const values = ["0"];
    const signatures = ["transfer(address,uint256)"];
    const calldatas = [
      "0x00000000000000000000000002a3037749fa094d7f2e206f70c0eb5fc4004c1c0000000000000000000000000000000000000000000000000000000005f5e100",
    ];
    const description = "test proposal";
    const emergency = false;
    await mineBlock();
    expect(await s.GOV.proposalCount()).to.eq(0);
    await s.GOV.propose(
      targets,
      values,
      signatures,
      calldatas,
      description,
      emergency
    );
    await mineBlock();
    expect(await s.GOV.proposalCount()).to.eq(1);
  });

  it("Verify Frank can't vote bc review period", async () => {
    const proposalId = await s.GOV.proposalCount();
    const support = 1;
    const reason = "good proposal";
    await expect(
      s.GOV.castVoteWithReason(proposalId, support, reason)
    ).to.be.revertedWith("voting is closed");
  });

  it("Verify Frank can vote after the review period", async () => {
    await advanceBlockHeight((await s.GOV.votingDelay()).toNumber());
    let bn = await ethers.provider.getBlockNumber();
    const proposalId = await s.GOV.proposalCount();
    let proposalInfo = await s.GOV.proposals(proposalId);
    expect(proposalInfo["startBlock"]).to.eq(bn);

    const support = 1;
    const reason = "good proposal";
    await s.GOV.castVoteWithReason(proposalId, support, reason);
    await mineBlock();
    proposalInfo = await s.GOV.proposals(proposalId);
    expect(proposalInfo["forVotes"]).to.be.gt(0);
  });

  it("Verify Frank can't queue the proposal", async () => {
    const proposalId = await s.GOV.proposalCount();
    await expect(s.GOV.queue(proposalId)).to.be.reverted;
  });

  it("Verify Frank can queue the proposal", async () => {
    await advanceBlockHeight((await s.GOV.votingPeriod()).toNumber());
    const proposalId = await s.GOV.proposalCount();
    await s.GOV.queue(proposalId);
    await mineBlock();
    let state = await s.GOV.state(proposalId);
    await expect(state).to.equal(5);
  });

  it("Verify Frank can't exeucte the proposal", async () => {
    const proposalId = await s.GOV.proposalCount();
    await expect(s.GOV.execute(proposalId)).to.be.reverted;
  });

  it("Verify Frank can exeucte the proposal", async () => {
    await fastForward((await s.GOV.proposalTimelockDelay()).toNumber());
    let startingBalance = await s.USDC.balanceOf(s.GOV.address);
    const proposalId = await s.GOV.proposalCount();
    await s.GOV.execute(proposalId);
    await mineBlock();
    let endingBalance = await s.USDC.balanceOf(s.GOV.address);
    expect(startingBalance).to.be.gt(endingBalance);
  });
  it("Verify Frank can transfer IPT to Eric", async () => {
    let startingBalance = await s.IPT.balanceOf(s.Eric.address);
    await s.IPT.transfer(s.Eric.address, "2500000000000000000000000");
    await mineBlock();
    let endingBalance = await s.IPT.balanceOf(s.Eric.address);
    expect(endingBalance).to.be.gt(startingBalance);
  });
  it("Verify Eric can delegate to Andy", async () => {
    await s.IPT.connect(s.Eric).delegate(s.Andy.address);
    await mineBlock();
    expect(await s.IPT.getCurrentVotes(s.Andy.address)).to.be.gt(0);
  });
})