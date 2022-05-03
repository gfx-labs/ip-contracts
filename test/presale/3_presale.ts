import { s } from "./scope";
//import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { BN } from "../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../util/math";
import { currentBlock } from "../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { Wave, IERC20__factory } from "../../typechain-types"

const hre = require("hardhat")
const { ethers } = hre;
const chai = require("chai");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect, assert } = chai;

//const merkleWallets = require("../data/data.json")
const data = require("../data/data.json")
//const merkletree = createTree();

//amount of IPT that is to be allocated
const keyAmount = BN("500e6")//500 USDC

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
const totalSupply_ = BN("1e26")
let Wave: Wave

require('chai')
    .should()
describe("Deploy wave", () => {

    before(async () => {
        await initMerkle()
    })

    it("deploys wave", async () => {

        //init constructor args

        const totalClaimed = totalSupply_.div(4)
        const floor = BN("5e5")//500,000 - .5 USDC
        const block = await currentBlock()
        const enableTime = block.timestamp
        disableTime = enableTime + OneWeek
        const receiver = s.Frank.address
        //showBody(s.Frank.address)

        const waveFactory = await ethers.getContractFactory("Wave")
        Wave = await waveFactory.deploy(root, totalClaimed, floor, enableTime, disableTime, receiver)
        await mineBlock()
        await Wave.deployed()
        await mineBlock()
    })
    it("Sanity check state of Wave contract", async () => {
        const merkleRoot = await Wave.merkleRoot()
        assert.equal(merkleRoot.toString(), root, "Merkle root is correct")

        const totalClaimed = await Wave._totalClaimed()
        //showBody(totalClaimed)
        //assert.equal(totalClaimed.toString(), totalSupply_.div(4).toString(), "Total reward is correct")

        const floor = await Wave._floor()
        assert.equal(floor.toNumber(), BN("5e5").toNumber(), "Floor is correct")

        const receiver = await Wave._receiver()
        assert.equal(receiver, s.Frank.address, "receiver is correct")

        const totalReward = await Wave._totalReward()
        //showBody("totalReward: ", totalReward)


    })
})


describe("Presale", () => {
    const amount = BN("100e6")//100 USDC
    let leaf: string
    let merkleProof: string[]
    let claimer:string

    it("claim some, but less than maximum", async () => {
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
    it("Claim maximum", async () => {
        const fullClaimAmount = amount.mul(4)//should be able to claim 400 more USDC worth 
        //starting balance is as expected
        const startBalance = await s.USDC.balanceOf(claimer)
        assert.equal(startBalance.toString(), s.Bob_USDC.sub(amount).toString(), "Bob's starting balance is correct")

        //approve
        await s.USDC.connect(s.Bob).approve(Wave.address, fullClaimAmount)
        await mineBlock()

        const gpResult = await Wave.connect(s.Bob).getPoints(fullClaimAmount, keyAmount, merkleProof)
        await mineBlock()
        const gpArgs = await getArgs(gpResult)

        assert.equal(fullClaimAmount.toString(), gpArgs.amount.toString(), "Amount is correct on event receipt")
        assert.equal(claimer, gpArgs.from.toString(), "From is correct on event receipt")

        //check balance
        let balance = await s.USDC.balanceOf(claimer)
        assert.equal(balance.toString(), s.Bob_USDC.div(2).toString(), "Bob's ending balance is correct")

        //check claimed on contract state
        let claimedAmount = await Wave.claimed(claimer)
        assert.equal(claimedAmount.toString(), amount.mul(5).toString(), "Claimed amount is correct")

        let _totalClaimed = await Wave._totalClaimed()
        assert.equal(_totalClaimed.toString(), amount.mul(5).toString(), "_totalClaimed amount is correct")
    })

    it("try to getPoints after alread getting maximum", async () => {
        //approve
        const tinyAmount = 1 //1e-18 IPT
        await s.USDC.connect(s.Bob).approve(Wave.address, tinyAmount)
        await mineBlock()

        //await expect(Wave.connect(s.Bob).getPoints(10, keyAmount, merkleProof)).to.be.reverted

        const pointsResult = await Wave.connect(s.Bob).getPoints(tinyAmount, keyAmount, merkleProof)
        await mineBlock()
        await expect(pointsResult.wait()).to.be.reverted

        //todo check state before revert
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

    it("redeem", async () => {
        const redeemResult = await Wave.connect(s.Bob).redeem()
        await mineBlock()

        
    })


    it("screatch", async () => {
        /**
         * 
         * 
         * 
         * 
    //getPoints

        //const addr = claimArray[2][0];
        //const key = claimArray[3][1];
        const amount = BN("100e6")//100 USDC
        const startingClaimed = await Wave._totalClaimed()

        let proof = merkleTree.getHexProof(solidityKeccak256(["address", "uint256"], [s.Andy.address, amount.toString()]))




        const pointsResult = await Wave.connect(s.Andy)
            .getPoints(
                amount,
                5,//key
                proof
                //getAccountProof(merkleTree, s.Andy.address, amount)
            )
        await mineBlock()
        //const pointsArgs = await getArgs(pointsResult)
        //showBody(pointsArgs)

        const endingClaimed = await Wave._totalClaimed()
        //showBody(startingClaimed)
        //showBody(endingClaimed)














         let redeemedState = await Wave.redeemed(s.Bob.address)
        //showBody("Initial redeemedState", redeemedState)

        await Wave.connect(s.Bob).redeem()
        await mineBlock()

        redeemedState = await Wave.redeemed(s.Bob.address)
        //showBody("new redeemedState", redeemedState)

        let isEnabled = await Wave.isEnabled()
        //showBody("isEnabled: ", isEnabled)
    

        //showBody("FAST FORWARD")
        await fastForward(OneWeek)
        await mineBlock()
         */





        //await expect(Wave.connect(s.Frank).redeem()).to.be.revertedWith("can't redeem yet")
    })
})