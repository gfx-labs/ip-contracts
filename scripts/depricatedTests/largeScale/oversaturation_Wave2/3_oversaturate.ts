import { s } from "../scope"
import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../../../util/format"
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"
import { BN } from "../../../../util/number"
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
} from "../../../../util/block"
import { utils, BigNumber } from "ethers"
import { ethers, network, tenderly } from "hardhat";
import {toNumber} from "../../../../util/math"
import { currentBlock, reset } from "../../../../util/block"
import MerkleTree from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"
import {
  WavePool__factory,
  WavePool,
} from "../../../../typechain-types"

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

let startingUSDC: BigNumber

require("chai").should()
describe("Deploy wave - OVERSATURATION IN WAVE 2", () => {
  before(async () => {
    await initMerkle()

    startingUSDC = await s.USDC.balanceOf(s.Carol.address)
    await s.USDC.connect(s.Carol).transfer(s.Gus.address, startingUSDC)
    await mineBlock()
    startingUSDC = await s.USDC.balanceOf(s.Carol.address)

    expect(startingUSDC).to.eq(0)//Carol starts with 0 USDC
  })

  it("deploys wave", async () => {

    const block = await currentBlock()
    const enableTime = block.timestamp
    disableTime = enableTime + (OneWeek * 3)

    const waveFactory = new WavePool__factory(s.Frank)
    Wave = await waveFactory.deploy(
      s.Carol.address,
      totalReward,
      s.IPT.address,
      s.USDC.address,
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

    assert.equal(s.Carol.address, s.Carol.address, "s.Carol.address is correct")

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

describe("Wave 1 claims do not reach oversaturation", () => {

  const wave1ClaimsTotal = BN("500000e6")//500k USDC
  const claimAmount = wave1ClaimsTotal.div(4)

  it("A few claims in wave 1", async () => {
    for (let i = 0; i < 4; i++) {
      showBody(`claiming ${i} of 4`)

      //merkle things
      let leaf = solidityKeccak256(["address", "uint256"], [s.whitelist1[i], key1])
      let merkleProof = merkleTree1.getHexProof(leaf)

      await s.Bank.sendTransaction({ to: s.whitelist1[i], value: utils.parseEther("0.5") })
      await advanceBlockHeight(1)

      await s.USDC.connect(s.Bank).transfer(s.whitelist1[i], claimAmount)
      await advanceBlockHeight(1)

      await impersonateAccount(s.whitelist1[i])
      let signer = ethers.provider.getSigner(s.whitelist1[i])

      await s.USDC.connect(signer).approve(Wave.address, claimAmount)
      await mineBlock()

      await Wave.connect(signer).getPoints(
        1,
        claimAmount,
        key1,
        merkleProof
      )
      await mineBlock()

      await ceaseImpersonation(s.whitelist1[i])
    }
  })

  it("Confirm wave 1 claimed the correct amount", async () => {
    const claimedTotal = await Wave._totalClaimed()
    expect(claimedTotal).to.eq(wave1ClaimsTotal)
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

  it("Wave 2 claims up to cap", async () => {
    let cap = await Wave._cap()
    let total = await Wave._totalClaimed()
    expect(total).to.be.lt(cap) //cap has not been reached
    const claimableAmount = cap.sub(total)
    const formatClaimable = claimableAmount.div(BN("1e6"))
    const FormatUsdcAmount = Math.floor(formatClaimable.toNumber() / s.randomWhitelist2.length)//everyone claims this much to reach cap
    const rawUSDCamount = FormatUsdcAmount * 1000000


    for (let i = 0; i < s.randomWhitelist2.length; i++) {
      showBody(`claiming ${i} of ${s.randomWhitelist2.length}`)

      //let claimed = ((await Wave._data(1, s.randomWhitelist1[i])).claimed).add(rawUSDCamount) <= key1
      let claimed = (await Wave._data(2, s.randomWhitelist2[i])).claimed
      const claimableAmount = key2.sub(claimed)
      let claimAmount = rawUSDCamount

      //prevent claims from exceeding key, as a result of randomly selected duplicates
      if (rawUSDCamount > claimableAmount.toNumber()) {
        claimAmount = claimableAmount.toNumber()
      }

      //merkle things
      let leaf = solidityKeccak256(["address", "uint256"], [s.randomWhitelist2[i], key2])
      let merkleProof = merkleTree2.getHexProof(leaf)

      await s.Bank.sendTransaction({ to: s.randomWhitelist2[i], value: utils.parseEther("0.5") })
      await advanceBlockHeight(1)

      await s.USDC.connect(s.Bank).transfer(s.randomWhitelist2[i], claimAmount)
      await advanceBlockHeight(1)

      await impersonateAccount(s.randomWhitelist2[i])
      let signer = ethers.provider.getSigner(s.randomWhitelist2[i])

      await s.USDC.connect(signer).approve(Wave.address, claimAmount)
      await mineBlock()

      await Wave.connect(signer).getPoints(
        2,
        claimAmount,
        key2,
        merkleProof
      )
      await mineBlock()

      await ceaseImpersonation(s.randomWhitelist2[i])
    }

  })
  it("1 more claim to reach cap", async () => {
    const cap = await Wave._cap()
    let totalClaimed = await Wave._totalClaimed()
    expect(totalClaimed).to.be.lt(cap) //cap has not been reached
    const claimableAmount = cap.sub(totalClaimed)

    const finalClaimer = ethers.provider.getSigner(s.whitelist2[0])
    await s.USDC.connect(s.Bank).transfer(finalClaimer._address, claimableAmount)
    await advanceBlockHeight(1)

    //merkle things
    let leaf = solidityKeccak256(["address", "uint256"], [finalClaimer._address, key2])
    let merkleProof = merkleTree2.getHexProof(leaf)

    await impersonateAccount(finalClaimer._address)

    await s.USDC.connect(finalClaimer).approve(Wave.address, claimableAmount)
    await mineBlock()

    await Wave.connect(finalClaimer).getPoints(
      2,
      claimableAmount,
      key2,
      merkleProof
    )
    await mineBlock()

    await ceaseImpersonation(finalClaimer._address)
  })
  it("Cap is reached, nobody is able to claim more", async () => {
    const cap = await Wave._cap()
    let totalClaimed = await Wave._totalClaimed()
    expect(totalClaimed).to.be.eq(cap) //cap has not been reached
    const claimableAmount = cap.sub(totalClaimed)



    const finalClaimer = ethers.provider.getSigner(s.whitelist2[1])
    await s.USDC.connect(s.Bank).transfer(finalClaimer._address, amount)
    await advanceBlockHeight(1)

    //merkle things
    let leaf = solidityKeccak256(["address", "uint256"], [finalClaimer._address, key2])
    let merkleProof = merkleTree2.getHexProof(leaf)

    await impersonateAccount(finalClaimer._address)

    await s.USDC.connect(finalClaimer).approve(Wave.address, amount)
    await mineBlock()

    await expect(Wave.connect(finalClaimer).getPoints(
      2,
      amount,
      key2,
      merkleProof
    )).to.be.revertedWith("Cap reached")
    await mineBlock()

    await ceaseImpersonation(finalClaimer._address)

  })
})

describe("Wave 3 claims", () => {
  it("advance time to enable wave 3", async () => {
    let enabled = await Wave.isEnabled(BN("3"))
    assert.equal(enabled, false, "Wave 3 is not yet enabled")

    await fastForward(OneWeek)
    await mineBlock()

    enabled = await Wave.isEnabled(BN("3"))
    assert.equal(enabled, true, "Wave 3 is now enabled")
  })

  it("Cap is reached, nobody is able to claim more", async () => {

    const cap = await Wave._cap()
    let totalClaimed = await Wave._totalClaimed()
    expect(totalClaimed).to.be.eq(cap) //cap has not been reached
    const claimableAmount = cap.sub(totalClaimed)

    const finalClaimer = ethers.provider.getSigner(s.whitelist1[1])
    await s.USDC.connect(s.Bank).transfer(finalClaimer._address, amount)
    await advanceBlockHeight(1)

    //merkle things
    let leaf = solidityKeccak256(["address", "uint256"], [finalClaimer._address, key1])
    let merkleProof = merkleTree1.getHexProof(leaf)

    await impersonateAccount(finalClaimer._address)

    await s.USDC.connect(finalClaimer).approve(Wave.address, amount)
    await mineBlock()

    await expect(Wave.connect(finalClaimer).getPoints(
      1,
      amount,
      key1,
      merkleProof
    )).to.be.revertedWith("Cap reached")
    await mineBlock()

    await ceaseImpersonation(finalClaimer._address)
  })
})

describe("Redemptions", () => {
  it("try to redeem before redemption time", async () => {
    const redeemer = ethers.provider.getSigner(s.whitelist1[1])
    await s.USDC.connect(s.Bank).transfer(redeemer._address, amount)
    await advanceBlockHeight(1)

    //merkle things
    let leaf = solidityKeccak256(["address", "uint256"], [redeemer._address, key1])
    let merkleProof = merkleTree1.getHexProof(leaf)

    await impersonateAccount(redeemer._address)

    await s.USDC.connect(redeemer).approve(Wave.address, amount)
    await mineBlock()

    await expect(Wave.connect(redeemer).redeem(1)).to.be.revertedWith("can't redeem yet")
    await mineBlock()

    await ceaseImpersonation(redeemer._address)

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

  })
  it("All redemptions done", async () => {
    //wave 1
    for (let i = 0; i < 4; i++) {
      showBody(`redeeming wave 1: ${i} of 4`)
      let redeemed = (await Wave._data(1, s.whitelist1[i])).redeemed
      let claimed = ((await Wave._data(1, s.whitelist1[i])).claimed)

      if (!redeemed && claimed.toNumber() > 0) {
        await impersonateAccount(s.whitelist1[i])
        let signer = ethers.provider.getSigner(s.whitelist1[i])

        await Wave.connect(signer).redeem(1)
        await mineBlock()

        await ceaseImpersonation(s.whitelist1[i])
      }
    }

    //wave 2
    for (let i = 0; i < s.randomWhitelist2.length; i++) {
      showBody(`redeeming wave 2:  ${i} of ${s.randomWhitelist2.length}`)
      let redeemed = (await Wave._data(2, s.randomWhitelist2[i])).redeemed

      if (!redeemed) {
        await impersonateAccount(s.randomWhitelist2[i])
        let signer = ethers.provider.getSigner(s.randomWhitelist2[i])

        await Wave.connect(signer).redeem(2)
        await mineBlock()

        await ceaseImpersonation(s.randomWhitelist2[i])
      }
    }

    //final claimer to reach cap
    await impersonateAccount(s.whitelist2[0])
    let signer = ethers.provider.getSigner(s.whitelist2[0])

    await Wave.connect(signer).redeem(2)
    await mineBlock()

    await ceaseImpersonation(s.whitelist2[0])

    let remainingIPT = await s.IPT.balanceOf(Wave.address)
    expect(remainingIPT).to.eq(0)//All IPT has been claimed
  })

  it("Try to redeem again", async () => {

    await impersonateAccount(s.whitelist1[0])
    let signer = ethers.provider.getSigner(s.whitelist1[0])

    await expect(Wave.connect(signer).redeem(1)).to.be.revertedWith("already redeem")
    await mineBlock()

    await ceaseImpersonation(s.whitelist1[0])

  })

  it("try admin withdraw", async () => {
    await expect(Wave.connect(s.Carol).withdraw()).to.be.revertedWith("Saturation reached")
    await mineBlock()
  })

  it("Check receiver balance", async () => {
    let receiverBalance = await s.USDC.balanceOf(s.Carol.address)
    const cap = await Wave._cap()

    expect(receiverBalance).to.eq(cap)
  })
})

