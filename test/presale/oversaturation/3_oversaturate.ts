import { s } from "../scope";
//import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import {
  advanceBlockHeight,
  nextBlockTime,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
} from "../../../util/block";
import { utils, BigNumber } from "ethers";
import {
  calculateAccountLiability,
  payInterestMath,
  calculateBalance,
  getGas,
  getArgs,
  truncate,
  getEvent,
  calculatetokensToLiquidate,
  calculateUSDI2repurchase,
  changeInBalance,
  toNumber,
} from "../../../util/math";
import { currentBlock, reset } from "../../../util/block";
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { Wave, IERC20__factory } from "../../../typechain-types";
import { red } from "bn.js";

const hre = require("hardhat");
const { ethers } = hre;
const chai = require("chai");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect, assert } = chai;

//const merkleWallets = require("../data/data.json")
//const data = require("../data/data.json")
//const merkletree = createTree();

//amount of IPT that is to be allocated

const initMerkle = async () => {
  //8 accunts to make a simple merkle tree
  whitelist = [
    s.Frank.address,
    s.Andy.address,
    s.Bob.address,
    s.Carol.address,
    s.Dave.address,
    s.Eric.address,
    s.Gus.address,
    s.Hector.address,
  ];
  const leafNodes = whitelist.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, keyAmount])
  );
  merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  root = merkleTree.getHexRoot();
};

let disableTime: number;
let whitelist: string[];
let root: string;
let merkleTree: MerkleTree;
const keyAmount = BN("500e6"); //500 USDC
const floor = BN("5e5"); //500,000 - .5 USDC
const amount = BN("100e6"); //100 USDC
const totalReward = BN("200e18"); //200 IPT

let Wave: Wave;

//todo - what happens if not all is redeemed, IPT stuck on Wave? Redeem deadline?
require("chai").should();
describe("Deploy wave", () => {
  before(async () => {
    await initMerkle();
  });

  it("deploys wave", async () => {
    //init constructor args

    const block = await currentBlock();
    const enableTime = block.timestamp;
    disableTime = enableTime + OneWeek;
    const receiver = s.Carol.address;
    //showBody(s.Frank.address)

    const waveFactory = await ethers.getContractFactory("Wave");
    Wave = await waveFactory.deploy(
      root,
      totalReward,
      floor,
      enableTime,
      disableTime,
      receiver,
      s.IPT.address
    );
    await mineBlock();
    await Wave.deployed();
    await mineBlock();

    await s.IPT.transfer(Wave.address, totalReward);
    await mineBlock();
  });
  it("Sanity check state of Wave contract", async () => {
    const merkleRoot = await Wave.merkleRoot();
    assert.equal(merkleRoot.toString(), root, "Merkle root is correct");

    const claimedTotal = await Wave._totalClaimed();
    assert.equal(claimedTotal.toString(), "0", "Total claimed is 0 (correct)");

    const floor = await Wave._floor();
    assert.equal(floor.toNumber(), BN("5e5").toNumber(), "Floor is correct");

    const receiver = await Wave._receiver();
    assert.equal(receiver, s.Carol.address, "receiver is correct");

    const rewardTotal = await Wave._totalReward();
    assert.equal(
      rewardTotal.toString(),
      totalReward.toString(),
      "Total reward is correct"
    );

    const IPTaddr = await Wave.rewardToken();
    assert.equal(IPTaddr, s.IPT.address, "IPT is initialized correctly");

    const WaveIPTbalance = await s.IPT.balanceOf(Wave.address);
    assert.equal(
      WaveIPTbalance.toString(),
      totalReward.toString(),
      "Wave has the correct amount of IPT"
    );
  });
});

describe("Presale - OVERSATURATION", () => {
  let leaf: string;
  let merkleProof: string[];
  let claimer: string;
  after(async () => {
    await reset(0);
  });
  it("Dave claims all possible tokens", async () => {
    claimer = s.Dave.address;

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount]);
    merkleProof = merkleTree.getHexProof(leaf);

    const fullClaimAmount = amount.mul(5);
    //starting balance is as expected
    const startBalance = await s.USDC.balanceOf(claimer);
    //assert.equal(startBalance.toString(), s.Dave_USDC.sub(amount).toString(), "Dave's starting balance is correct")

    //approve
    await s.USDC.connect(s.Dave).approve(Wave.address, fullClaimAmount);
    await mineBlock();

    const gpResult = await Wave.connect(s.Dave)
      .getPoints(fullClaimAmount, keyAmount, merkleProof)
      .catch(console.log);
    await mineBlock();
    const gpArgs = await getArgs(gpResult);

    assert.equal(
      fullClaimAmount.toString(),
      gpArgs.amount.toString(),
      "Amount is correct on event receipt"
    );
    assert.equal(
      claimer,
      gpArgs.from.toString(),
      "From is correct on event receipt"
    );

    //check balance
    let balance = await s.USDC.balanceOf(claimer);
    assert.equal(
      balance.toString(),
      s.Dave_USDC.div(2).toString(),
      "Dave's ending balance is correct"
    );

    //check claimed on contract state
    let claimedAmount = await Wave.claimed(claimer);
    assert.equal(
      claimedAmount.toString(),
      amount.mul(5).toString(),
      "Claimed amount is correct"
    );

    let _totalClaimed = await Wave._totalClaimed();
    assert.equal(
      _totalClaimed.toString(),
      keyAmount.mul(1).toString(),
      "_totalClaimed amount is correct"
    );
  });

  it("Bob claims some, but less than maximum", async () => {
    claimer = s.Bob.address;

    let cap = await Wave._cap();
    let total = await Wave._totalClaimed();

    expect(total).to.be.lt(cap)//cap has not been reached


    //starting balance is as expected
    const startBalance = await s.USDC.balanceOf(claimer);
    assert.equal(
      startBalance.toString(),
      s.Bob_USDC.toString(),
      "Bob's starting balance is correct"
    );

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount]);
    merkleProof = merkleTree.getHexProof(leaf);
    //   showBody("leaf proof: ", merkleProof);

    //approve
    await s.USDC.connect(s.Bob).approve(Wave.address, amount);
    await mineBlock();

    const gpResult = await Wave.connect(s.Bob).getPoints(
      amount.div(2),
      keyAmount,
      merkleProof
    );
    await mineBlock();
    const gpArgs = await getArgs(gpResult);
    assert.equal(
      amount.div(2).toString(),
      gpArgs.amount.toString(),
      "Amount is correct on event receipt"
    );
    assert.equal(
      claimer,
      gpArgs.from.toString(),
      "From is correct on event receipt"
    );

    //check balance
    let balance = await s.USDC.balanceOf(claimer);
    assert.equal(
      balance.toString(),
      s.Bob_USDC.sub(amount.div(2)).toString(),
      "Bob's ending balance is correct"
    );

    //check claimed on contract state
    let claimedAmount = await Wave.claimed(claimer);
    assert.equal(
      claimedAmount.toString(),
      amount.div(2).toString(),
      "Claimed amount is correct"
    );

    let _totalClaimed = await Wave._totalClaimed();
    /**
     assert.equal(
      _totalClaimed.toString(),
      (amount.div(2)).mul(6).toString(),
      "_totalClaimed amount is correct"
    );
     */
  });

  it("try to make a claim that would exceed cap", async () => {
    claimer = s.Bob.address

    //confirm starting values
    let cap = await Wave._cap();
    let total = await Wave._totalClaimed();
    expect(total).to.be.lt(cap)//cap has not been reached
    const difference = cap.sub(total)
    assert.equal(await toNumber(difference), await toNumber(amount.div(2)), "Amount availalble to be claimed is correct")


    //approve
    await s.USDC.connect(s.Dave).approve(Wave.address, amount);
    await mineBlock();

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount]);
    merkleProof = merkleTree.getHexProof(leaf);
    //   showBody("leaf proof: ", merkleProof);

    const gpResult = await Wave.connect(s.Bob)
      .getPoints(amount, keyAmount, merkleProof)
      .catch(console.log);
    await mineBlock();

    //tx reverted
    await expect(gpResult!.wait()).to.be.reverted

  })

  it("Claim exactly up to maximum", async () => {
    claimer = s.Bob.address

    let cap = await Wave._cap();
    let total = await Wave._totalClaimed();
    expect(total).to.be.lt(cap)//cap has not been reached
    const claimableAmount = cap.sub(total)
    //approve
    await s.USDC.connect(s.Dave).approve(Wave.address, claimableAmount);
    await mineBlock();

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount]);
    merkleProof = merkleTree.getHexProof(leaf);
    //   showBody("leaf proof: ", merkleProof);

    const gpResult = await Wave.connect(s.Bob)
      .getPoints(claimableAmount, keyAmount, merkleProof)
      .catch(console.log);
    await mineBlock();
    const gpArgs = await getArgs(gpResult);

    assert.equal(
      claimableAmount.toString(),
      gpArgs.amount.toString(),
      "Amount is correct on event receipt"
    );
    assert.equal(
      claimer,
      gpArgs.from.toString(),
      "From is correct on event receipt"
    );

    //todo check points

  })

  //test for over saturation
  it("Confirm cap has been reached", async () => {
    const cap = await Wave._cap();
    const _totalClaimed = await Wave._totalClaimed();

    assert.equal(cap.toString(), _totalClaimed.toString(), "Cap has been reached")

  })

  it("try to claim after cap has been reached", async () => {
    const fullClaimAmount = amount.mul(2);
    //starting balance is as expected
    const startBalance = await s.USDC.balanceOf(claimer);
    assert.equal(
      startBalance.toString(),
      s.Bob_USDC.sub(amount).toString(),
      "Bob's starting balance is correct"
    );

    //approve
    await s.USDC.connect(s.Bob).approve(Wave.address, fullClaimAmount);
    await mineBlock();

    const gpResult = await Wave.connect(s.Bob).getPoints(
      fullClaimAmount,
      keyAmount,
      merkleProof
    );
    await mineBlock();
    await expect(gpResult.wait()).to.reverted;
  });

  it("try to getPoints after you already claimed maximum", async () => {
    //approve
    const tinyAmount = 1; //1e-18 IPT
    await s.USDC.connect(s.Bob).approve(Wave.address, tinyAmount);
    await mineBlock();

    const pointsResult = await Wave.connect(s.Bob).getPoints(
      tinyAmount,
      keyAmount,
      merkleProof
    );
    await mineBlock();
    await expect(pointsResult.wait()).to.be.reverted;

    //todo check state before revert
  });

  it("redeem before time has elapsed", async () => {
    let canRedeem = await Wave.canRedeem();
    assert.equal(canRedeem, false, "canRedeem is false");

    let redeemed = await Wave.redeemed(s.Bob.address);
    assert.equal(redeemed, false, "Bob has not redeemed yet");

    const redeemResult = await Wave.connect(s.Bob).redeem();
    await mineBlock();
    await expect(redeemResult.wait()).to.be.reverted;
  });

  it("elapse time", async () => {
    await fastForward(OneWeek);
    await mineBlock();

    //check things
    const block = await currentBlock();
    const currentTime = block.timestamp;

    //time is now past disable time
    expect(currentTime).to.be.gt(disableTime);

    let canRedeem = await Wave.canRedeem();
    assert.equal(canRedeem, true, "canRedeem is now true");

    let redeemed = await Wave.redeemed(s.Bob.address);
    assert.equal(redeemed, false, "Bob has not redeemed yet");
  });

  it("Admin should not be able to claim any IPT due to claim saturation", async () => {
    const startingCarolIPT = await s.IPT.balanceOf(s.Carol.address);
    assert.equal(startingCarolIPT.toString(), "0", "Carol holds 0 IPT");

    //withdraw
    const withdrawResult = await Wave.connect(s.Carol).withdraw();
    await mineBlock();
    await expect(withdrawResult.wait()).to.be.reverted;

    const EndingCarolIPT = await s.IPT.balanceOf(s.Carol.address);
    assert.equal(
      EndingCarolIPT.toString(),
      "0",
      "Carol did not receive any IPT"
    );
  });

  it("Bob redeems and receives pro-rata share, Dave has not redeemed yet", async () => {
    let startingBobIPT = await s.IPT.balanceOf(s.Bob.address);
    assert.equal(
      startingBobIPT.toString(),
      "0",
      "Bob holds no IPT before redeem"
    );

    const totalPoints = await Wave._totalClaimed()
    const BobPoints = await Wave.claimed(s.Bob.address)
    const DavePoints = await Wave.claimed(s.Dave.address)

    expect(await toNumber(BobPoints.add(DavePoints))).to.eq(await toNumber(totalPoints))

    const WaveIPT = await s.IPT.balanceOf(Wave.address)
    const totalReward = await Wave._totalReward()

    expect(await toNumber(WaveIPT)).to.eq(await toNumber(totalReward))


    const redeemResult = await Wave.connect(s.Bob).redeem();
    await mineBlock();
    //check things
    let waveIPT = await s.IPT.balanceOf(Wave.address);
    let difference = totalReward.sub(waveIPT);
    let balance = await s.IPT.balanceOf(s.Bob.address);

    assert.equal(
      difference.toString(),
      balance.toString(),
      "Bob received IPT in the correct amount"
    );

    /**
     * bob has 100/600 total points
     * dave has 500/600 total points
     * 200 IPT exist in this wave
     * 
     * bob's simple ratio is 1/6 == 0.16666 
     * 
     * bob should end up with 1/6 of the IPT == ~33.333 IPTs
     * dave should end up with 5/6 of the IPT == 166.666 IPTs
     */
    const simpleRatio = await toNumber(BobPoints) / await toNumber(totalPoints)

    const expectedIPT = simpleRatio * await toNumber(totalReward)  
    //confirm Bob has the expected ratio of IPT
    expect(await toNumber(balance)).to.be.closeTo(expectedIPT, 0.004)

    
    //todo confirm floor price??


  });

  it("Dave redeems last", async () => {
    let startingDaveIPT = await s.IPT.balanceOf(s.Dave.address);
    assert.equal(
      startingDaveIPT.toString(),
      "0",
      "Dave holds no IPT before redeem"
    );

    const startingWaveIPT = await s.IPT.balanceOf(Wave.address);

    const totalPoints = await Wave._totalClaimed()
    const DavePoints = await Wave.claimed(s.Dave.address)

    const simpleRatio = await toNumber(DavePoints) / await toNumber(totalPoints)
    const expectedIPT = simpleRatio * await toNumber(totalReward)  

    const redeemResult = await Wave.connect(s.Dave).redeem();
    await mineBlock();
    await expect(redeemResult.wait()).to.not.reverted;

    //check things
    let waveIPT = await s.IPT.balanceOf(Wave.address);
    let difference = totalReward.sub(waveIPT);
    let balance = await s.IPT.balanceOf(s.Dave.address);
    //showBody("dave balance:", balance);

    expect(difference, "dave balanace match").to.be.closeTo(totalReward, 2);
    expect(balance, "received correct amt").to.be.closeTo(startingWaveIPT, 2);
    expect(waveIPT, "wave no longer has ipt").to.be.closeTo(BN(0), 2);

    expect(await toNumber(balance)).to.be.closeTo(expectedIPT, 0.004)

    //todo calc exact ratio of IPT received 
  });
});
