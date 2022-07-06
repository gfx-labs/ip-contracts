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
} from "../../../../util/block"
import { utils, BigNumber } from "ethers"
import {
  getArgs,
  truncate,
  toNumber,
} from "../../../../util/math"
import { currentBlock, reset } from "../../../../util/block"
import MerkleTree from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"
import {
  IERC20__factory,
  WavePool__factory,
  WavePool,
} from "../../../../typechain-types"



let disableTime: number
let whitelist1: string[]
let whitelist2: string[]

const floor = BN("250000") //500,000 - .5 USDC
const amount = BN("100e6") //100 USDC
const totalReward = utils.parseEther("30000000")//30,000,000 IPT 

let Wave: WavePool

//todo - what happens if not all is redeemed, IPT stuck on Wave? Redeem deadline?
require("chai").should()
describe("Deploy wave - OVERSATURATION", () => {
 

  it("deploys wave", async () => {
    
  })
  it("Sanity check state of Wave contract", async () => {
   
  })
})

describe("Wave 1 claims", () => {
  it("Dave claims all possible tokens", async () => {
    
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


