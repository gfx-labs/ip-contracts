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
  getGas
} from "../../../../util/math"
import { currentBlock, reset } from "../../../../util/block"
import { DeployContract } from "../../../../util/deploy"
import MerkleTree from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"
import {
  SlowRoll,
  SlowRoll__factory
} from "../../../../typechain-types"
import { randomBytes } from "crypto"



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

/**
 * Daily price resets to min each day
 * if max price is reached, all sales will be at that price for the day until cap is reached
 */

describe("Wave 1 claims", () => {
  const claimAmount1 = BN("500e6")//500 USDC


  const testMaxQ = BN("10000e18")//10k IPT
  const testStartPrice = BN("100000")//0.10 USDC
  const testMaxPrice = BN("250000")//0.25 USDC
  const testWaveDuration = OneDay - 1

  it("Check starting values", async () => {

    let startIPT = await s.IPT.balanceOf(s.Dave.address)
    expect(startIPT).to.eq(0, "Dave holds 0 IPT at the start")

    startIPT = await s.IPT.balanceOf(SlowRoll.address)
    expect(startIPT).to.eq(IPTamount, "Starting IPT balance is correct")

    let price = await SlowRoll.getCurrentPrice()
    expect(price).to.eq(.25 * BN("1e6").toNumber(), "Start price is correct")
    //expect(price).to.be.lt(await SlowRoll.getCurrentPrice(), "Price has increased")


  })

  it("Admin adjusts params", async () => {
    await SlowRoll.connect(s.Frank).setMaxQuantity(testMaxQ)
    await SlowRoll.connect(s.Frank).setStartPrice(testStartPrice)
    await SlowRoll.connect(s.Frank).setMaxPrice(testMaxPrice)
    await SlowRoll.connect(s.Frank).setWaveDuration(testWaveDuration)
    await mineBlock()

    expect(await SlowRoll._maxQuantity()).to.eq(testMaxQ, "Max Quantity has been set correctly")
    expect(await SlowRoll._startPrice()).to.eq(testStartPrice, "Start price has been set correctly")
    expect(await SlowRoll._maxPrice()).to.eq(testMaxPrice, "Max price has been set correctly")
    expect(await SlowRoll._waveDuration()).to.eq(testWaveDuration, "Wave duration has been set correctly")


  })

  it("Day 1 claims", async () => {
    await s.USDC.connect(s.Andy).approve(SlowRoll.address, claimAmount1)
    const result = await SlowRoll.connect(s.Andy).getPoints(claimAmount1)
    await mineBlock()
    const gas = await getGas(result)
    showBodyCyan("Gas to getPoints: ", gas)

    await s.USDC.connect(s.Bob).approve(SlowRoll.address, claimAmount1)
    await SlowRoll.connect(s.Bob).getPoints(claimAmount1)
    await mineBlock()

    await s.USDC.connect(s.Carol).approve(SlowRoll.address, claimAmount1)
    await expect(SlowRoll.connect(s.Carol).getPoints(claimAmount1)).to.be.revertedWith("Cap reached")
  })

  it("Day 2 claims", async () => {

    await fastForward(OneDay)
    await mineBlock()

    //Carol can now claim, daily cap should reset
    await s.USDC.connect(s.Carol).approve(SlowRoll.address, claimAmount1)
    await SlowRoll.connect(s.Carol).getPoints(claimAmount1)
    await mineBlock()
    const remaining = await (await SlowRoll._maxQuantity()).sub(await SlowRoll._soldQuantity())
    expect(remaining).to.eq(testMaxQ.div(2), "Carol claimed half of the daily allowance of IPT")

  })

  it("Claim up to price maximum", async () => {

    await fastForward(OneDay)
    await mineBlock()

    await SlowRoll.connect(s.Frank).forceNewDay()
    await mineBlock()
    expect(await SlowRoll.getCurrentPrice()).to.eq(testStartPrice, "Price reset to min after day reset")

    await s.USDC.connect(s.accounts[10]).approve(SlowRoll.address, s.baseUSDC)
    await SlowRoll.connect(s.accounts[10]).getPoints(s.baseUSDC)
    await mineBlock()

    const remaining = await (await SlowRoll._maxQuantity()).sub(await SlowRoll._soldQuantity())
    expect(remaining).to.eq(0, "1k USDC is enough to reach daily maximum")

    expect(await SlowRoll.getCurrentPrice()).to.eq(testMaxPrice, "1k USDC moves price from min to max")
  })

  it("Fast forward to next day", async () => {
    await fastForward(OneDay)
    await mineBlock()
  })

  it("Admin adjusts the prices, more claims on the same day", async () => {

    //small claim in the begining of the day
    const smallClaimAmount = BN("200e6")//200 USDC
    await s.USDC.connect(s.accounts[12]).approve(SlowRoll.address, smallClaimAmount)
    await SlowRoll.connect(s.accounts[12]).getPoints(smallClaimAmount)
    await mineBlock()

    const preAdjustRemaining = await (await SlowRoll._maxQuantity()).sub(await SlowRoll._soldQuantity())
    const preAdjustPrice = await SlowRoll.getCurrentPrice()

    //admin adjusts prices 
    await SlowRoll.connect(s.Frank).setMaxPrice(testMaxPrice.add(testMaxPrice.sub(testStartPrice)))
    await mineBlock()
    await SlowRoll.connect(s.Frank).setStartPrice(testMaxPrice)
    await mineBlock()

    const newRemaining = await (await SlowRoll._maxQuantity()).sub(await SlowRoll._soldQuantity())
    const newPrice = await SlowRoll.getCurrentPrice()

    expect(newPrice).to.be.gt(preAdjustPrice, "Adjusting the price values made the price go up")
    expect(newRemaining).to.be.eq(preAdjustRemaining, "Adjusting the price did not change the cap")

    await s.USDC.connect(s.accounts[11]).approve(SlowRoll.address, s.baseUSDC)
    await SlowRoll.connect(s.accounts[11]).getPoints(s.baseUSDC)
    await mineBlock()

    const remaining = await (await SlowRoll._maxQuantity()).sub(await SlowRoll._soldQuantity())
    expect(remaining).to.gt(0, "1k USDC is no longer enough to reach daily maximum")

    expect(await SlowRoll.getCurrentPrice()).to.be.lt(await SlowRoll._maxPrice(), "More USDC is needed to reach daily max price as less IPT are sold per USDC")
  })
})

describe("Change Parameters", () => {

  //starting values
  let startPrice: BigNumber, maxPrice: BigNumber, currentPrice: BigNumber, maxQuantity: BigNumber

  beforeEach(async () => {
    currentPrice = await SlowRoll.getCurrentPrice()
    //showBody("price: ", currentPrice)

    maxQuantity = await SlowRoll._maxQuantity()
    //showBody("maxQuantity: ", await toNumber(maxQuantity))

    startPrice = await SlowRoll._startPrice()
    //showBody("startPrice: ", startPrice)

    maxPrice = await SlowRoll._maxPrice()
    //showBody("maxPrice: ", maxPrice)
  })
  it("Change maxQuantity", async () => {
    const prevPrice = currentPrice

    //set to only slightly higher than current sold quantity
    const soldQ = await SlowRoll._soldQuantity()
    await SlowRoll.connect(s.Frank).setMaxQuantity(soldQ.add(BN("10e18")))
    await mineBlock()

    let price = await SlowRoll.getCurrentPrice()
    expect(price).to.be.gt(prevPrice, "Price has increased as a result of setting a new maxQuantity")

  })

  it("Change startPrice", async () => {
    const newPrice = 350000
    const prevPrice = currentPrice

    await SlowRoll.connect(s.Frank).setStartPrice(newPrice)
    await mineBlock()

    let newStartPrice = await SlowRoll._startPrice()
    expect(newStartPrice).to.eq(newPrice, "New price has been set")

    let price = await SlowRoll.getCurrentPrice()
    expect(price).to.be.gt(prevPrice, "Price has increased as a result of setting a new startPrice")
  })
  it("Change maxPrice", async () => {
    const prevPrice = currentPrice
    const currentMax = maxPrice

    await SlowRoll.connect(s.Frank).setMaxPrice(currentMax.add(BN("100000")))//increase by $0.10
    await mineBlock()

    let price = await SlowRoll.getCurrentPrice()
    expect(price).to.be.gt(prevPrice, "Price has increased as a result of setting a new max price")

  })

  it("Set new day", async () => {

    let soldQ = await SlowRoll._soldQuantity()
    expect(soldQ).to.be.gt(0, "Tokens have been sold today")
    expect(currentPrice).to.be.gt(startPrice, "Price has increased as tokens have been sold")
    expect(currentPrice).to.be.lt(maxPrice, "Max price has not yet been reached")


    await SlowRoll.connect(s.Frank).forceNewDay()
    await mineBlock()

    let price = await SlowRoll.getCurrentPrice()
    soldQ = await SlowRoll._soldQuantity()

    expect(price).to.eq(startPrice)
    expect(soldQ).to.eq(0, "Sold quantity reset to 0")


  })
})


