import { s } from "../scope"
import { expect, assert } from "chai"
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
import { ethers, network, tenderly } from "hardhat";

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
  IERC20__factory,
  WavePool__factory,
  WavePool,
} from "../../../typechain-types"
import { red } from "bn.js"
import exp from "constants"
import { start } from "repl"
import { JsonRpcSigner } from "@ethersproject/providers"

const { solidity } = require("ethereum-waffle")


const initMerkle = async () => {

  let leafNodes = s.whitelist1.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, key1])
  )
  merkleTree1 = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
  root1 = merkleTree1.getHexRoot()

  leafNodes = s.whitelist2.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, key2])
  )
  merkleTree2 = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
  root2 = merkleTree2.getHexRoot()

}

let disableTime: number

let root1: string
let root2: string
let merkleTree1: MerkleTree
let merkleTree2: MerkleTree
const key1 = BN("1000000e6") //1,000,000 USDC
const key2 = BN("500000e6") //500,000 USDC
const floor = BN("250000") //0.5 USDC
const amount = BN("100e6") //100 USDC
const totalReward = utils.parseEther("30000000")//30,000,000 IPT 

let Wave: WavePool

//todo - what happens if not all is redeemed, IPT stuck on Wave? Redeem deadline?
require("chai").should()
describe("Deploy wave - OVERSATURATION IN WAVE 1", () => {
  before(async () => {
    await initMerkle()
  })

  it("deploys wave", async () => {
    //init constructor argsclclear

    const block = await currentBlock()
    const enableTime = block.timestamp
    disableTime = enableTime + (OneWeek * 3)
    const receiver = s.Carol.address

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

    const Readfloor = await Wave._floor()
    assert.equal(Readfloor.toNumber(), floor.toNumber(), "Floor is correct")

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

describe("Wave 1 claims and reach oversaturation", () => {
  let leaf: string
  let merkleProof: string[]
  let claimer: string

  const tempAddr = "0xac35b645b14d8252d49df77948ef3c215f2ec13f"
  let signer: JsonRpcSigner

  //set up temp signer
  before(async () => {
    signer = ethers.provider.getSigner(tempAddr)
  })

  it("Wave 1 claims up to cap", async () => {
    const cap = await Wave._cap()
    const formatCap = cap.div(BN("1e6"))
    const FormatUsdcAmount = Math.floor(formatCap.toNumber() / s.whitelist1.length)//everyone claims this much to reach cap
    const rawUSDCamount = FormatUsdcAmount * 1000000

    let wallet = ethers.Wallet.createRandom();


    //merkle things
    leaf = solidityKeccak256(["address", "uint256"], [wallet.address, key1])
    merkleProof = merkleTree1.getHexProof(leaf)

    await s.USDC.connect(s.Bank).transfer(signer._address, BN("500e6"))//send USDC funds
    await mineBlock()

    await s.Bank.sendTransaction({ to: signer._address, value: utils.parseEther("0.5") })//send some eth for gas
    await advanceBlockHeight(1)

    //await s.USDC.connect(signer).approve(Wave.address, BN("500e6"))
    //await mineBlock()

    



  })

  it("Dave tries to getPoints after you having already claimed maximum", async () => {

  })

  it("Bob claims some, but less than maximum", async () => {


  })

  it("try to make a claim that would exceed cap", async () => {

  })

  it("try to claim the wrong wave", async () => {


  })

  it("try to claim more than key amount", async () => {

  })

  it("Bob claims exactly up to maximum", async () => {


  })

})

/**
 describe("Wave 2 claims", () => {
  it("advance time to enable wave 2", async () => {

  })

  it("Everyone on wave 2 claims their key amount", async () => {

  })

  it("non whitelisted address tries to claim during wave 2", async () => {

  })

  it("Admin tries to withdraw before claim period has ended", async () => {
  })

  it("Try to redeem before claim time", async () => {

  })

})//wave 2 claims

describe("Wave 3 claims", () => {
  let merkleProof: any

  it("advance time to enable wave 3", async () => {

  })

  it("Previous claimers can claim more", async () => {


  })

  it("non whitelisted participitant claims as much as they can", async () => {

  })

  it("claim up to cap to reach maximum saturation", async () => {

  })

  it("Dave tries to claim some after cap has been reached", async () => {

  })

})

describe("Redemptions", () => {
  const floor = 500000 //$0.5 USDC - hard coded into contract
  it("try to redeem before redemption time", async () => {
  })
  it("admin withdraw before redemption time", async () => {
  })

  it("advance time to enable redeem", async () => {


  })
  it("Bob redeems", async () => {


  })

  it("Bob tries to redeem again", async () => {

  })

  it("try admin withdraw during redemption time but before admin withdraw time", async () => {
  })
  it("advance time to enable admin withdraw", async () => {

  })
  it("try admin withdraw", async () => {


  })

})

 */