import { s } from "../scope"
import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../../../util/format"
import { BN } from "../../../../util/number"
import {
  advanceBlockHeight,
  nextBlockTime,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  OneDay
} from "../../../../util/block"
import { utils, BigNumber } from "ethers"
import {
  getArgs,
  truncate,
  toNumber,
} from "../../../../util/math"
import { currentBlock, reset } from "../../../../util/block"
import { DeployContract } from "../../../../util/deploy"
import MerkleTree from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"
import {
  SlowRoll,
  SlowRoll__factory
} from "../../../../typechain-types"



let disableTime: number
let whitelist1: string[]
let whitelist2: string[]

const floor = BN("250000") //500,000 - .5 USDC
const amount = BN("100e6") //100 USDC
const totalReward = utils.parseEther("30000000")//30,000,000 IPT 

let SlowRoll: SlowRoll

const IPTamount = BN("500000e18")

//todo - what happens if not all is redeemed, IPT stuck on Wave? Redeem deadline?
require("chai").should()
describe("Deploy wave - OVERSATURATION", () => {


  it("deploys wave", async () => {
    SlowRoll = await DeployContract(
      new SlowRoll__factory(s.Frank),
      s.Frank,
      s.IPT.address
    )
    await mineBlock()
    await SlowRoll.deployed()

    await s.IPT.connect(s.Frank).transfer(SlowRoll.address, IPTamount)
    await mineBlock()
  })
  it("Sanity check state of Wave contract", async () => {
    expect(await SlowRoll._owner()).to.eq(s.Frank.address)
    expect(await toNumber(await SlowRoll._maxQuantity())).to.eq(500000, "Starting IPT is correct")
    expect(await SlowRoll._owner()).to.eq(s.Frank.address)
    expect(await SlowRoll._startPrice()).to.eq(.25 * BN("1e6").toNumber(), "Start price is .25 USDC")
    expect(await SlowRoll._maxPrice()).to.eq(.50 * BN("1e6").toNumber(), "Max price is .25 USDC")
    expect(await SlowRoll._waveDuration()).to.eq(OneDay, "Wave duration is correct")
  })
})

describe("Wave 1 claims", () => {
  const claimAmount1 = BN("500e6")//500 USDC
  it("Dave claims some points", async () => {

    await s.USDC.connect(s.Dave).approve(SlowRoll.address, claimAmount1)
    await SlowRoll.connect(s.Dave).getPoints(claimAmount1)
    await mineBlock()

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

  it("someone tries to claim who is not in this wave", async () => {

  })

  it("Bob claims exactly up to maximum", async () => {


  })
})


