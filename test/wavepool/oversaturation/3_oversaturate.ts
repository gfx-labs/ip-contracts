import { s } from "../scope"
//import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../../util/format"
import { BN } from "../../../util/number"
import {
  advanceBlockHeight,
  nextBlockTime,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
} from "../../../util/block"
import { utils, BigNumber } from "ethers"
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
} from "../../../util/math"
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"
import {
  Wave,
  IERC20__factory,
  WavePool__factory,
  WavePool,
} from "../../../typechain-types"
import { red } from "bn.js"
import exp from "constants"

const hre = require("hardhat")
const { ethers } = hre
const chai = require("chai")

const { solidity } = require("ethereum-waffle")
chai.use(solidity)
const { expect, assert } = chai



const initMerkle = async () => {
  //8 accunts to make a simple merkle tree
  whitelist1 = [
    s.Bob.address,
    s.Dave.address,
  ]
  let leafNodes = whitelist1.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, keyAmount])
  )
  merkleTree1 = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
  root1 = merkleTree1.getHexRoot()

  whitelist2 = [
    s.Frank.address,
    s.Andy.address,
    s.Bob.address,
    s.Carol.address,
    s.Dave.address,
    s.Eric.address,
    s.Gus.address,
    s.Hector.address,
  ]
  leafNodes = whitelist2.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, keyAmount])
  )
  merkleTree2 = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
  root2 = merkleTree2.getHexRoot()
}

let disableTime: number
let whitelist1: string[]
let whitelist2: string[]
let root1: string
let root2: string
let merkleTree1: MerkleTree
let merkleTree2: MerkleTree
const keyAmount = BN("200e6") //200 USDC
const floor = BN("5e5") //500,000 - .5 USDC
const amount = BN("100e6") //100 USDC
const totalReward = utils.parseEther("30000000")//30,000,000 IPT 

let Wave: WavePool

//todo - what happens if not all is redeemed, IPT stuck on Wave? Redeem deadline?
require("chai").should()
describe("Deploy wave - OVERSATURATION", () => {
  before(async () => {
    await initMerkle()
  })

  it("deploys wave", async () => {
    //init constructor args

    const block = await currentBlock()
    const enableTime = block.timestamp
    disableTime = enableTime + (OneWeek * 3)
    const receiver = s.Carol.address
    //showBody(s.Frank.address)

    const waveFactory = new WavePool__factory(s.Frank)
    Wave = await waveFactory.deploy(
      receiver,
      totalReward,
      s.IPT.address,
      disableTime, //time when claiming points for all is disabled
      root1,
      enableTime,//time when claiming points for wave 1 is enabled
      root2,
      enableTime + OneWeek,//time when claiming points for wave 2 is enabled (wave1 + oneWeek)
      Array(32).fill(0),
      enableTime + OneWeek + OneWeek //time when claiming points for wave 3 is enabled (wave1 + oneWeek * 2)
    )
    await mineBlock()
    await Wave.deployed()
    await mineBlock()
    await s.IPT.transfer(Wave.address, totalReward)
    await mineBlock()
  })
  it("Sanity check state of Wave contract", async () => {
    const merkleRoot = (await Wave._metadata(1)).merkleRoot
    assert.equal(merkleRoot.toString(), root1, "Merkle root is correct")

    const claimedTotal = await Wave._totalClaimed()
    assert.equal(claimedTotal.toString(), "0", "Total claimed is 0 (correct)")

    const floor = await Wave._floor()
    assert.equal(floor.toNumber(), BN("5e5").toNumber(), "Floor is correct")

    const receiver = await Wave._receiver()
    assert.equal(receiver, s.Carol.address, "receiver is correct")

    const rewardTotal = await Wave._totalReward()
    assert.equal(
      rewardTotal.toString(),
      totalReward.toString(),
      "Total reward is correct"
    )

    const IPTaddr = await Wave._rewardToken()
    assert.equal(IPTaddr, s.IPT.address, "IPT is initialized correctly")

    const WaveIPTbalance = await s.IPT.balanceOf(Wave.address)
    assert.equal(
      WaveIPTbalance.toString(),
      totalReward.toString(),
      "Wave has the correct amount of IPT"
    )
  })
})

describe("Wave 1 claims", () => {
  let leaf: string
  let merkleProof: string[]
  let claimer: string




  it("Dave claims all possible tokens", async () => {
    claimer = s.Dave.address

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount])
    merkleProof = merkleTree1.getHexProof(leaf)

    //starting balance is as expected
    const startBalance = await s.USDC.balanceOf(claimer)
    //assert.equal(startBalance.toString(), s.Dave_USDC.sub(amount).toString(), "Dave's starting balance is correct")

    //approve
    await s.USDC.connect(s.Dave).approve(Wave.address, keyAmount)
    await mineBlock()

    const gpResult = await Wave.connect(s.Dave).getPoints(
      1,
      keyAmount,
      keyAmount,
      merkleProof
    )
    await mineBlock()
    const gpArgs = await getArgs(gpResult)

    assert.equal(
      keyAmount.toString(),
      gpArgs.amount.toString(),
      "Amount is correct on event receipt"
    )
    assert.equal(
      claimer,
      gpArgs.from.toString(),
      "From is correct on event receipt"
    )

    //check balance
    let balance = await s.USDC.balanceOf(claimer)
    assert.equal(
      balance.toString(),
      s.Dave_USDC.sub(keyAmount).toString(),
      "Dave's ending balance is correct"
    )

    //check claimed on contract state matches key amount
    let claimedAmount = (await Wave._data(1, claimer)).claimed
    assert.equal(
      claimedAmount.toString(),
      keyAmount.toString(),
      "Claimed amount is correct"
    )

    let _totalClaimed = await Wave._totalClaimed()
    assert.equal(
      _totalClaimed.toString(),
      keyAmount.toString(),
      "_totalClaimed amount is correct"
    )
  })

  it("Dave tries to getPoints after you having already claimed maximum", async () => {
    //approve
    const tinyAmount = 1 //1e-18 IPT
    await s.USDC.connect(s.Dave).approve(Wave.address, tinyAmount)
    await mineBlock()

    const pointsResult = Wave.connect(s.Dave).getPoints(
      1,
      tinyAmount,
      keyAmount,
      merkleProof
    )
    await mineBlock()
    await expect(pointsResult).to.be.reverted

    //todo check state before revert
  })

  it("Bob claims some, but less than maximum", async () => {
    claimer = s.Bob.address

    let cap = await Wave._cap()
    let total = await Wave._totalClaimed()
    expect(total).to.be.lt(cap) //cap has not been reached
    //starting balance is as expected
    const startBalance = await s.USDC.balanceOf(claimer)
    assert.equal(
      startBalance.toString(),
      s.Bob_USDC.toString(),
      "Bob's starting balance is correct"
    )

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount])
    merkleProof = merkleTree1.getHexProof(leaf)
    //   showBody("leaf proof: ", merkleProof)

    //approve
    await s.USDC.connect(s.Bob).approve(Wave.address, amount)
    await mineBlock()

    const gpResult = await Wave.connect(s.Bob).getPoints(
      1,
      keyAmount.div(2),
      keyAmount,
      merkleProof
    )
    await mineBlock()
    const gpArgs = await getArgs(gpResult)
    assert.equal(
      keyAmount.div(2).toString(),
      gpArgs.amount.toString(),
      "Amount is correct on event receipt"
    )
    assert.equal(
      claimer,
      gpArgs.from.toString(),
      "From is correct on event receipt"
    )

    //check balance
    let balance = await s.USDC.balanceOf(claimer)
    assert.equal(
      balance.toString(),
      s.Bob_USDC.sub(keyAmount.div(2)).toString(),
      "Bob's ending balance is correct"
    )

    //check claimed on contract state
    let claimedAmount = (await Wave._data(1, claimer)).claimed
    assert.equal(
      claimedAmount.toString(),
      keyAmount.div(2).toString(),
      "Claimed amount is correct"
    )

    let _totalClaimed = await Wave._totalClaimed()
    //todo?
  })

  it("try to make a claim that would exceed cap", async () => {
    claimer = s.Bob.address

    //confirm starting values
    let cap = await Wave._cap()
    let total = await Wave._totalClaimed()
    expect(total).to.be.lt(cap) //cap has not been reached
    const claimableAmount = cap.sub(total)
    /**
    assert.equal(await toNumber(difference), await toNumber(amount.div(2)), "Amount availalble to be claimed is correct")
     */
    //approve
    await s.USDC.connect(s.Dave).approve(Wave.address, amount)
    await mineBlock()

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount])
    merkleProof = merkleTree1.getHexProof(leaf)
    //   showBody("leaf proof: ", merkleProof)

    const gpResult = Wave.connect(s.Bob).getPoints(
      1,
      claimableAmount.add(500),
      keyAmount,
      merkleProof
    )
    //tx reverted
    await expect(gpResult).to.be.reverted
  })

  it("try to claim the wrong wave", async () => {

    let balance = await s.USDC.balanceOf(s.Bob.address)
    //approve
    await s.USDC.connect(s.Bob).approve(Wave.address, balance)
    await mineBlock()

    let invalidWaveID = 3

    await expect(Wave.connect(s.Bob).getPoints(
      invalidWaveID,
      balance,
      keyAmount,
      merkleProof
    )).to.be.revertedWith("not enabled")
    await mineBlock()
    invalidWaveID = 2

    await expect(Wave.connect(s.Bob).getPoints(
      invalidWaveID,
      balance,
      keyAmount,
      merkleProof
    )).to.be.revertedWith("not enabled")
    await mineBlock()
  })

  it("try to claim more than key amount", async () => {
    let cap = await Wave._cap()
    let total = await Wave._totalClaimed()
    expect(total).to.be.lt(cap) //cap has not been reached
    let claimableAmount = cap.sub(total)

    //approve
    await s.USDC.connect(s.Bob).approve(Wave.address, claimableAmount)
    await mineBlock()

    await expect(Wave.connect(s.Bob).getPoints(
      1,
      claimableAmount,
      keyAmount,
      merkleProof
    )).to.be.revertedWith("max alloc claimed")
    await mineBlock()

  })

  it("someone tries to claim who is not in this wave", async () => {

    //approve
    await s.USDC.connect(s.Carol).approve(Wave.address, keyAmount.div(2))
    await mineBlock()

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [s.Carol.address, keyAmount])
    merkleProof = merkleTree2.getHexProof(leaf)

    await expect(Wave.connect(s.Carol).getPoints(
      1,
      keyAmount.div(2),
      keyAmount,
      merkleProof
    )).to.be.revertedWith("invalid proof")
    await mineBlock()

    //try with wave 2, this proof is valid but wave 2 is not enabled yet
    await expect(Wave.connect(s.Carol).getPoints(
      2,
      keyAmount.div(2),
      keyAmount,
      merkleProof
    )).to.be.revertedWith("not enabled")
    await mineBlock()

    //try proof on merkle tree 1
    merkleProof = merkleTree1.getHexProof(leaf)

    await expect(Wave.connect(s.Carol).getPoints(
      1,
      keyAmount.div(2),
      keyAmount,
      merkleProof
    )).to.be.revertedWith("invalid proof")
    await mineBlock()

  })

  it("Bob claims exactly up to maximum", async () => {
    claimer = s.Bob.address

    let cap = await Wave._cap()
    let total = await Wave._totalClaimed()
    expect(total).to.be.lt(cap) //cap has not been reached
    let claimableAmount = cap.sub(total)

    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [claimer, keyAmount])
    merkleProof = merkleTree1.getHexProof(leaf)
    //approve
    await s.USDC.connect(s.Bob).approve(Wave.address, keyAmount.div(2))
    await mineBlock()
    const gpResult = await Wave.connect(s.Bob).getPoints(
      1,
      keyAmount.div(2),
      keyAmount,
      merkleProof
    )
    await mineBlock()

    //Bob has claimed maximum
    let bobClaim = await Wave._data(1, s.Bob.address)
    expect(await toNumber(bobClaim.claimed)).to.eq(await toNumber(keyAmount))

  })

})

describe("Wave 2 claims", () => {
  it("advance time to enable wave 2", async () => {

    let enabled = await Wave.isEnabled(BN("2"))
    assert.equal(enabled, false, "Wave 2 is not yet enabled")

    await fastForward(OneWeek)
    await mineBlock()

    enabled = await Wave.isEnabled(BN("2"))
    assert.equal(enabled, true, "Wave 2 is now enabled")
  })

  it("Everyone on wave 2 claims their key amount", async () => {

    for (let i = 0; i < whitelist2.length; i++) {
      //Bob and Dave have already claimed for wave 1 but not wave 2
      //merkle things
      let leaf = solidityKeccak256(["address", "uint256"], [whitelist2[i], keyAmount])
      let merkleProof = merkleTree2.getHexProof(leaf)

      //approve
      await s.USDC.connect(s.accounts[i]).approve(Wave.address, keyAmount)
      await mineBlock()
      const gpResult = await Wave.connect(s.accounts[i]).getPoints(
        2,
        keyAmount,
        keyAmount,
        merkleProof
      )
      await mineBlock()

      let claim = await Wave._data(2, s.accounts[i].address)
      expect(await toNumber(claim.claimed)).to.eq(await toNumber(keyAmount))
    }

    //bob claimed twice as he is in both waves
    let claimed1 = await Wave._data(1, s.Bob.address)
    let claimed2 = await Wave._data(2, s.Bob.address)
    assert.equal(claimed1.claimed.toString(), claimed2.claimed.toString(), "Bob claimed full key amount on waves 1 and 2")


    //can't claim anymore
    let leaf = solidityKeccak256(["address", "uint256"], [s.Bob.address, keyAmount])
    let merkleProof = merkleTree2.getHexProof(leaf)
    //approve
    await s.USDC.connect(s.Bob).approve(Wave.address, 5)
    await mineBlock()
    await expect(Wave.connect(s.Bob).getPoints(
      2,
      5,
      keyAmount,
      merkleProof
    )).to.be.revertedWith("max alloc claimed")

    //check totalClaimed
    const totalClaimed = await Wave._totalClaimed()
    expect(await toNumber(totalClaimed)).to.eq(await toNumber(keyAmount.mul(10)))
  })

  it("non whitelisted address tries to claim during wave 2", async () => {
    //can't claim anymore
    let leaf = solidityKeccak256(["address", "uint256"], [s.Igor.address, keyAmount])
    let merkleProof = merkleTree2.getHexProof(leaf)
    //approve
    await s.USDC.connect(s.Igor).approve(Wave.address, keyAmount)
    await mineBlock()
    await expect(Wave.connect(s.Igor).getPoints(
      2,
      keyAmount,
      keyAmount,
      merkleProof
    )).to.be.revertedWith("invalid proof")
    await mineBlock()

    //try passing wave 3
    await expect(Wave.connect(s.Igor).getPoints(
      3,
      keyAmount,
      keyAmount,
      merkleProof
    )).to.be.revertedWith("not enabled")
    await mineBlock()
  })

  it("Admin tries to withdraw before claim period has ended", async () => {
    await expect(Wave.connect(s.Carol).withdraw()).to.be.revertedWith("calculatePricing() first")
  })

  it("Try to redeem before claim time", async () => {
    await expect(Wave.connect(s.Bob).redeem(1)).to.be.revertedWith("can't redeem yet")
    await expect(Wave.connect(s.Bob).redeem(2)).to.be.revertedWith("can't redeem yet")
  })

})//wave 2 claims

describe("Wave 3 claims", () => {
  let merkleProof: any

  it("advance time to enable wave 3", async () => {
    let enabled = await Wave.isEnabled(BN("3"))
    assert.equal(enabled, false, "Wave 3 is not yet enabled")

    await fastForward(OneWeek)
    await mineBlock()

    enabled = await Wave.isEnabled(BN("3"))
    assert.equal(enabled, true, "Wave 3 is now enabled")
  })

  it("Previous claimers can claim more", async () => {

    let leaf = solidityKeccak256(["address", "uint256"], [s.Bob.address, keyAmount])
    merkleProof = merkleTree2.getHexProof(leaf)


    //approve
    await s.USDC.connect(s.Bob).approve(Wave.address, keyAmount)
    await mineBlock()

    const gpResult = await Wave.connect(s.Bob).getPoints(
      3,
      keyAmount,
      keyAmount,//this is irrelevant for wave 3
      merkleProof//this is irrelevant for wave 3
    )
    await mineBlock()

    let claimed3 = await Wave._data(3, s.Bob.address)
    assert.equal(claimed3.claimed.toString(), keyAmount.toString(), "Bob claimed full key amount on wave 3")


  })

  it("non whitelisted participitant claims as much as they can", async () => {
    let balance = await s.USDC.balanceOf(s.Igor.address)

    //approve
    await s.USDC.connect(s.Igor).approve(Wave.address, balance)
    await mineBlock()

    const gpResult = await Wave.connect(s.Igor).getPoints(
      3,
      balance,
      keyAmount,//this is irrelevant for wave 3
      merkleProof//this is irrelevant for wave 3
    )
    await mineBlock()
  })

  it("claim up to cap to reach maximum saturation", async () => {
    const cap = await Wave._cap()
    let totalClaimed = await Wave._totalClaimed()
    expect(totalClaimed).to.be.lt(cap) //cap has not been reached
    const claimableAmount = cap.sub(totalClaimed)

    //bank has enough to claim all
    const startBalance = await s.USDC.balanceOf(s.Bank.address)
    expect(await toNumber(startBalance)).to.be.gt(await toNumber(claimableAmount))

    //approve
    await s.USDC.connect(s.Bank).approve(Wave.address, claimableAmount)
    await mineBlock()

    const gpResult = await Wave.connect(s.Bank).getPoints(
      3,
      claimableAmount,
      keyAmount,//this is irrelevant for wave 3
      merkleProof//this is irrelevant for wave 3
    )
    await mineBlock()

    //bank has the correct amount of points
    let bankPoints = await Wave._data(3, s.Bank.address)
    expect(bankPoints.claimed.toNumber()).to.eq(claimableAmount.toNumber())

    //cap has been reached
    totalClaimed = await Wave._totalClaimed()
    expect(totalClaimed.toNumber()).to.eq(cap.toNumber())

  })

  it("try to claim some after cap has been reached", async () => {
    //Dave tries to claim more
    //approve
    await s.USDC.connect(s.Dave).approve(Wave.address, keyAmount)
    await mineBlock()

    await expect(Wave.connect(s.Dave).getPoints(
      3,
      keyAmount,
      keyAmount,//this is irrelevant for wave 3
      merkleProof//this is irrelevant for wave 3
    )).to.be.revertedWith("Cap reached")
    await mineBlock()
  })

})

describe("Redemptions", () => {
  const floor = 500000 //$0.5 USDC - hard coded into contract
  it("try to redeem before redemption time", async () => {
    await expect(Wave.connect(s.Dave).redeem(2)).to.be.revertedWith("can't redeem yet")
  })
  it("admin withdraw before redemption time", async () => {
    await expect(Wave.connect(s.Carol).withdraw()).to.be.revertedWith("calculatePricing() first")
  })

  it("advance time to enable redeem", async () => {
    let enabled = await Wave.canRedeem()
    assert.equal(enabled, false, "Not yet redeem time")

    await fastForward(OneWeek)
    await mineBlock()

    enabled = await Wave.canRedeem()
    assert.equal(enabled, true, "Redeem time now active")

    let calculated = await Wave.calculated()
    expect(calculated).to.eq(false)
    await Wave.calculatePricing()
    await mineBlock()
    calculated = await Wave.calculated()
    expect(calculated).to.eq(true)
  })
  it("Bob redeems", async () => {
    //Bob claimed 3x so his points are keyAmount * 3
    const claimAmount = keyAmount.mul(3)
    const startingIPT = await s.IPT.balanceOf(s.Bob.address)
    expect(startingIPT).to.eq(0)

    await Wave.connect(s.Bob).redeem(1)
    await mineBlock()
    await Wave.connect(s.Bob).redeem(2)
    await mineBlock()
    await Wave.connect(s.Bob).redeem(3)
    await mineBlock()

    let balance = await s.IPT.balanceOf(s.Bob.address)
    let scaledClaimAmount = claimAmount.mul(BN("1e12"))
    let scaledFloor = BN(floor).mul(BN("1e12"))

    let expected = await truncate(scaledClaimAmount.mul(scaledFloor))

    expect(await toNumber(balance)).to.eq(await toNumber(expected))

  })

  it("Bob tries to redeem again", async () => {
    await expect(Wave.connect(s.Bob).redeem(1)).to.be.revertedWith("already redeem")
    await mineBlock()
    await expect(Wave.connect(s.Bob).redeem(2)).to.be.revertedWith("already redeem")
    await mineBlock()
    await expect(Wave.connect(s.Bob).redeem(3)).to.be.revertedWith("already redeem")
    await mineBlock()
  })

  it("try admin withdraw during redemption time but before admin withdraw time", async () => {
    await expect(Wave.connect(s.Carol).withdraw()).to.be.revertedWith("Saturation reached")
  })
  it("advance time to enable admin withdraw", async () => {
    await fastForward(OneWeek)
    await mineBlock()
  })
  it("try admin withdraw", async () => {
    await expect(Wave.connect(s.Carol).withdraw()).to.be.revertedWith("Saturation reached")
    await mineBlock()

  })

})
