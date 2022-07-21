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
import {
  impersonateAccount,
  ceaseImpersonation
} from "../../../../util/impersonator"
import { ethers, network, tenderly } from "hardhat";
import { utils, BigNumber } from "ethers"
import {
  getArgs,
  truncate,
  toNumber,
} from "../../../../util/math"
import { currentBlock, reset } from "../../../../util/block"
import { getGas } from "../../../../util/math"
import MerkleTree from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"
import {
  IERC20__factory,
  RollingWave__factory,
  RollingWave,
} from "../../../../typechain-types"
import { delay } from "lodash"
import { wave1 } from "../../../../scripts/deployment/wave1"

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
let whitelist1: string[]
let whitelist2: string[]
let root1: string
let root2: string
let merkleTree1: MerkleTree
let merkleTree2: MerkleTree
const key1 = BN("500000e6") //500k USDC
const key2 = BN("250000e6") //250k USDC

const floor = BN("250000") //0.25 USDC
const totalReward = utils.parseEther("35000000")//35,000,000 IPT 
const roundReward = totalReward.div(3)//~~11.66 MM USDC

const wave1ClaimsTotal = BN("5000000e6")//5MM USDC
const wave2ClaimsTotal = BN("3000000e6")//3MM USDC

let Wave: RollingWave

require("chai").should()
describe("Rolling Wave - PARTIAL SATURATION", () => {
  before(async () => {
    await initMerkle()
  })

  it("deploys rolling wave", async () => {

    //init constructor args
    const block = await currentBlock()
    const enableTime = block.timestamp
    disableTime = enableTime + (OneWeek * 3)
    const receiver = s.Frank.address

    const waveFactory = new RollingWave__factory(s.Frank)

    Wave = await waveFactory.deploy(
      s.Frank.address,
      utils.parseEther("35000000"),
      s.IPT.address,
      s.USDC.address,
      enableTime,
      OneWeek,
      OneWeek,
      root1,
      root2,
      floor
    )
    await mineBlock()
    await Wave.deployed()
    await mineBlock()
    await s.IPT.transfer(Wave.address, totalReward)
    await mineBlock()
  })

  describe("Round 1 claims", () => {

    it("Wave 1 Round 1 CLAIMS", async () => {
      const claimableAmount = wave1ClaimsTotal
      const formatClaimable = claimableAmount.div(BN("1e6"))
      const FormatUsdcAmount = Math.floor(formatClaimable.toNumber() / s.randomWhitelist1.length)//everyone claims this much to reach cap
      const rawUSDCamount = FormatUsdcAmount * 1000000
      let claimAmount = rawUSDCamount

      //prevent claims from exceeding key, as a result of randomly selected duplicates
      if (rawUSDCamount > claimableAmount.toNumber()) {
        claimAmount = claimableAmount.toNumber()
      }

      for (let i = 0; i < s.randomWhitelist1.length; i++) {
        //showBody(`claiming ${i} of ${s.randomWhitelist1.length} for wave 1`)

        let signer = await ethers.getSigner(s.randomWhitelist1[i])

        //merkle things
        let leaf = solidityKeccak256(["address", "uint256"], [signer.address, key1])
        let merkleProof = merkleTree1.getHexProof(leaf)

        await s.Bank.sendTransaction({ to: signer.address, value: utils.parseEther("0.5") })//gas to claim
        await advanceBlockHeight(1)

        await s.USDC.connect(s.Bank).transfer(signer.address, claimAmount)//USDC to claim 
        await advanceBlockHeight(1)

        await impersonateAccount(signer.address)

        await s.USDC.connect(signer).approve(Wave.address, claimAmount)

        await Wave.connect(signer).getPoints(
          1,
          claimAmount,
          key1,
          merkleProof
        )
        await mineBlock()
        await ceaseImpersonation(signer.address)
      }
    })//wave 1 claims

    it("Fast forward to enable wave 2", async () => {

      const nextWave = 2

      let enabled = await Wave.isEnabled(nextWave)
      expect(enabled).to.eq(false, "Next wave is not enabled")

      await fastForward(OneWeek)
      await mineBlock()

      //verify next wave is enabled
      enabled = await Wave.isEnabled(nextWave)
      expect(enabled).to.eq(true, "Next wave is enabled")
    })

    it("Wave 2 Round 1 CLAIMS", async () => {
      const claimableAmount = wave2ClaimsTotal
      const formatClaimable = claimableAmount.div(BN("1e6"))
      const FormatUsdcAmount = Math.floor(formatClaimable.toNumber() / s.randomWhitelist2.length)//everyone claims this much to reach cap
      const rawUSDCamount = FormatUsdcAmount * 1000000
      let claimAmount = rawUSDCamount

      //prevent claims from exceeding key, as a result of randomly selected duplicates
      if (rawUSDCamount > claimableAmount.toNumber()) {
        claimAmount = claimableAmount.toNumber()
      }

      for (let i = 0; i < s.randomWhitelist2.length; i++) {
        //showBody(`claiming ${i} of ${s.randomWhitelist2.length} for wave 2`)

        let signer = await ethers.getSigner(s.randomWhitelist2[i])

        //merkle things
        let leaf = solidityKeccak256(["address", "uint256"], [signer.address, key2])
        let merkleProof = merkleTree2.getHexProof(leaf)

        await s.Bank.sendTransaction({ to: signer.address, value: utils.parseEther("0.5") })//gas to claim
        await advanceBlockHeight(1)

        await s.USDC.connect(s.Bank).transfer(signer.address, claimAmount)//USDC to claim 
        await advanceBlockHeight(1)

        await impersonateAccount(signer.address)

        await s.USDC.connect(signer).approve(Wave.address, claimAmount)

        await Wave.connect(signer).getPoints(
          2,
          claimAmount,
          key2,
          merkleProof
        )
        await mineBlock()
        await ceaseImpersonation(signer.address)
      }
    })//wave 2 claims

    it("Check things post claim", async () => {
      const totalClaimed = await Wave._totalClaimed()
      const expected = wave1ClaimsTotal.add(wave2ClaimsTotal)
      expect(totalClaimed.toNumber()).to.be.closeTo(expected.toNumber(), 20000000)//+/- 20 USDC

      const roundData = await Wave._roundMetaData(1)
      const roundClaimed = roundData.roundClaimed
      expect(roundClaimed.toNumber()).to.be.closeTo(expected.toNumber(), 20000000)//+/- 20 USDC

      const canRedeem = await Wave.canRedeem(1)
      expect(canRedeem).to.eq(false, "Can not redeem yet")

      const account1 = await Wave._data(1, s.randomWhitelist1[1])
      expect(account1.claimed).to.be.gt(0, "Some amount has been claimed")
      expect(account1.redeemed).to.eq(false, "Has not redeemed yet")
      const account2 = await Wave._data(2, s.randomWhitelist2[1])
      expect(account2.claimed).to.be.gt(0, "Some amount has been claimed")
      expect(account2.redeemed).to.eq(false, "Has not redeemed yet")
    })
  })

  describe("Rount 1 redemptions", () => {
    it("Fast forward to enable round 1 redemptions", async () => {

      const round = 1

      let enabled = await Wave.canRedeem(round)
      expect(enabled).to.eq(false, "Can't redeem round 1 yet")

      await fastForward(OneWeek)
      await mineBlock()

      //verify next wave is enabled
      enabled = await Wave.canRedeem(round)
      expect(enabled).to.eq(true, "Round 1 is now redeemable ")
    })

    it("Wave 1 Round 1 REDEMPTIONS", async () => {

      for(let i=0; i<s.randomWhitelist1.length; i++){
        const signer = await ethers.getSigner(s.randomWhitelist1[i])
        await impersonateAccount(signer.address)

        await Wave.connect(signer).redeem(1)
        await mineBlock()

        await ceaseImpersonation(signer.address)
      }
    })
    it("Check calculations", async () => {

      const round1Data = await Wave._roundMetaData(1)
      showBody(round1Data)
      showBody("Implied price: ", round1Data.impliedPrice)
      expect(round1Data.calculated).to.eq(true, "Calculation is done")
      expect(round1Data.saturation).to.eq(true, "Saturation reached")
      expect(round1Data.roundFloor).to.eq(floor, "Round 1 floor matches original floor price")
      expect(round1Data.impliedPrice).to.be.gt(floor.toNumber(), "Implied price is higher than floor due to saturation")
      expect(round1Data.roundClaimed).to.be.closeTo(wave1ClaimsTotal.toNumber(), 20000000)//+/- 20 USDC



    })

  })

  describe("Round 2 claims", () => {
    it("advance time to enable round 2", async () => {

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

  describe("Round 3 claims", () => {
    let merkleProof: any
    it("advance time to enable wave 3", async () => {

    })

    it("Previous claimers can claim more", async () => {

    })

    it("non whitelisted participitant claims as much as they can", async () => {

    })

    it("claim up to half of the available tokens to reach partial saturation", async () => {

    })
  })

  describe("Redemptions", () => {
    it("try to redeem before redemption time", async () => {
    })
    it("admin withdraw before redemption time", async () => {
    })

    it("advance time to enable redeem", async () => {

    })

    it("Everyone redeems", async () => {

    })

    it("confirm division error", async () => {


    })

    it("Bob tries to redeem again", async () => {

    })

    it("Check ending balance of a claimer", async () => {

    })

    it("Check ending balance of the last to withdraw", async () => {

    })

    it("try admin withdraw", async () => {

    })
  })
})