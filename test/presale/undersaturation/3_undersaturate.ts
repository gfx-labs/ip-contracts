import { s } from "../scope";
//import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { Wave, IERC20__factory } from "../../../typechain-types"
import { red } from "bn.js";

const hre = require("hardhat")
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
        s.Hector.address
    ]
    const leafNodes = whitelist.map(addr => solidityKeccak256(["address", "uint256"], [addr, keyAmount]))
    merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
    root = merkleTree.getHexRoot()

}

let disableTime:number
let whitelist: string[]
let root: string
let merkleTree: MerkleTree
const keyAmount = BN("500e6")//500 USDC
const floor = BN("5e5")//500,000 - .5 USDC
const amount = BN("100e6")//100 USDC
const totalSupply_ = BN("1e26")
const totalReward = BN("300e18")//250 IPT tokens //totalSupply_.div(4)

let Wave: Wave

//todo - what happens if not all is redeemed, IPT stuck on Wave? Redeem deadline? 
require('chai')
    .should()
describe("Deploy wave", () => {

    before(async () => {
        await initMerkle()
    })

    it("deploys wave", async () => {

        //init constructor args

        
        const block = await currentBlock()
        const enableTime = block.timestamp
        disableTime = enableTime + OneWeek
        const receiver = s.Frank.address
        //showBody(s.Frank.address)

        const waveFactory = await ethers.getContractFactory("Wave")
        Wave = await waveFactory.deploy(root, totalReward, floor, enableTime, disableTime, receiver, s.IPT.address)
        await mineBlock()
        await Wave.deployed()
        await mineBlock()

        await s.IPT.transfer(Wave.address, totalReward)
        await mineBlock()
    })
    it("Sanity check state of Wave contract", async () => {
        const merkleRoot = await Wave.merkleRoot()
        assert.equal(merkleRoot.toString(), root, "Merkle root is correct")

        const claimedTotal = await Wave._totalClaimed()
        assert.equal(claimedTotal.toString(), "0", "Total claimed is 0 (correct)")

        const floor = await Wave._floor()
        assert.equal(floor.toNumber(), BN("5e5").toNumber(), "Floor is correct")

        const receiver = await Wave._receiver()
        assert.equal(receiver, s.Frank.address, "receiver is correct")

        const rewardTotal = await Wave._totalReward()
        assert.equal(rewardTotal.toString(), totalReward.toString(), "Total reward is correct")

        const IPTaddr = await Wave.rewardToken()
        assert.equal(IPTaddr, s.IPT.address, "IPT is initialized correctly")

        const WaveIPTbalance = await s.IPT.balanceOf(Wave.address)
        assert.equal(WaveIPTbalance.toString(), totalReward.toString(), "Wave has the correct amount of IPT")

    })
})


describe("Presale", () => {
    let leaf: string
    let merkleProof: string[]
    let claimer:string
    after(async() => {
        await reset(0)
    })
    it("Bob claims some, but less than maximum", async () => {
        claimer = s.Bob.address

        //starting balance is as expected
        const startBalance = await s.USDC.balanceOf(claimer)
        assert.equal(startBalance.toString(), s.Bob_USDC.toString(), "Bob's starting balance is correct")

        //merkle things
        leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount])
        merkleProof = merkleTree.getHexProof(leaf)
        //showBody("leaf proof: ", merkleProof)

        //approve
        await s.USDC.connect(s.Bob).approve(Wave.address, amount)
        await mineBlock()

        const gpResult = await Wave.connect(s.Bob).getPoints(amount, keyAmount, merkleProof)
        await mineBlock()
        const gpArgs = await getArgs(gpResult)
        assert.equal(amount.toString(), gpArgs.amount.toString(), "Amount is correct on event receipt")
        assert.equal(claimer, gpArgs.from.toString(), "From is correct on event receipt")

        //check balance
        let balance = await s.USDC.balanceOf(claimer)
        assert.equal(balance.toString(), s.Bob_USDC.sub(amount).toString(), "Bob's ending balance is correct")

        //check claimed on contract state
        let claimedAmount = await Wave.claimed(claimer)
        assert.equal(claimedAmount.toString(), amount.toString(), "Claimed amount is correct")

        let _totalClaimed = await Wave._totalClaimed()
        assert.equal(_totalClaimed.toString(), amount.toString(), "_totalClaimed amount is correct")

    })    

    it("redeem before time has elapsed", async () => {
        let canRedeem = await Wave.canRedeem()
        assert.equal(canRedeem, false, "canRedeem is false")

        let redeemed = await Wave.redeemed(s.Bob.address)
        assert.equal(redeemed, false, "Bob has not redeemed yet")

        const redeemResult = await Wave.connect(s.Bob).redeem()
        await mineBlock()
        await expect(redeemResult.wait()).to.be.reverted
    })

    it("elapse time", async () => {
        await fastForward(OneWeek)
        await mineBlock()

        //check things
        const block = await currentBlock()
        const currentTime = block.timestamp

        //time is now past disable time
        expect(currentTime).to.be.gt(disableTime)

        let canRedeem = await Wave.canRedeem()
        assert.equal(canRedeem, true, "canRedeem is now true")

        let redeemed = await Wave.redeemed(s.Bob.address)
        assert.equal(redeemed, false, "Bob has not redeemed yet")
    })

    it("Bob redeems and receives pro-rata share, Carol has not redeemed yet", async () => {
        let startingBobIPT = await s.IPT.balanceOf(s.Bob.address)
        assert.equal(startingBobIPT.toString(), "0", "Bob holds no IPT before redeem")

        const redeemResult = await Wave.connect(s.Bob).redeem()
        await mineBlock()

        //check things
        let waveIPT = await s.IPT.balanceOf(Wave.address)
        let balance = await s.IPT.balanceOf(s.Bob.address)
        const formatAmount = amount.mul(BN("1e12"))

        assert.equal(balance.toString(), formatAmount.div(2).toString(), "Bob has the correct amount of IPT")
        assert.equal(waveIPT.toString(), totalReward.sub(formatAmount.div(2)).toString(), "Wave has the correct amount of IPT")

        let redeemed = await Wave.redeemed(s.Bob.address)
        assert.equal(redeemed, true, "Bob has redeemed")

    })

    it("Bob tries to redeem again", async () => {

        let startingBobIPT = await s.IPT.balanceOf(s.Bob.address)

        const redeemResult = await Wave.connect(s.Bob).redeem()
        await mineBlock()
        await expect(redeemResult.wait()).to.be.reverted

        let balance = await s.IPT.balanceOf(s.Bob.address)

        assert.equal(startingBobIPT.toString(), balance.toString(), "Balances have not changed")

        
    })


   
})