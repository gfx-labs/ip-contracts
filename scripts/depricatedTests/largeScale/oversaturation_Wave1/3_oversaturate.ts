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
const totalReward = utils.parseEther("35000000")//30,000,000 IPT 

let Wave: WavePool

//todo - what happens if not all is redeemed, IPT stuck on Wave? Redeem deadline?
require("chai").should()
describe("Deploy wave - OVERSATURATION IN WAVE 1", () => {
  before(async () => {
    await initMerkle()
  })

  it("deploys wave", async () => {
    const block = await currentBlock()
    const enableTime = block.timestamp
    disableTime = enableTime + (OneWeek * 3)
    const receiver = s.Carol.address

    const waveFactory = new WavePool__factory(s.Frank)
    Wave = await waveFactory.deploy(
      receiver,
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
  it("Everyone in wave 1 claims, cap is nearly reached", async () => {
    const cap = await Wave._cap()
    const formatCap = cap.div(BN("1e6"))
    const FormatUsdcAmount = Math.floor(formatCap.toNumber() / s.randomWhitelist1.length)//everyone claims this much to reach cap
    const rawUSDCamount = FormatUsdcAmount * 1000000

    for (let i = 0; i < s.randomWhitelist1.length; i++) {
      showBody(`claiming ${i} of ${s.randomWhitelist1.length}`)

      //let claimed = ((await Wave._data(1, s.randomWhitelist1[i])).claimed).add(rawUSDCamount) <= key1
      let claimed = (await Wave._data(1, s.randomWhitelist1[i])).claimed
      const claimableAmount = key1.sub(claimed)
      let claimAmount = rawUSDCamount

      //prevent claims from exceeding key, as a result of randomly selected duplicates
      if (rawUSDCamount > claimableAmount.toNumber()) {
        claimAmount = claimableAmount.toNumber()
      }

      //merkle things
      let leaf = solidityKeccak256(["address", "uint256"], [s.randomWhitelist1[i], key1])
      let merkleProof = merkleTree1.getHexProof(leaf)

      await s.Bank.sendTransaction({ to: s.randomWhitelist1[i], value: utils.parseEther("0.5") })
      await advanceBlockHeight(1)

      await s.USDC.connect(s.Bank).transfer(s.randomWhitelist1[i], claimAmount)
      await advanceBlockHeight(1)

      await impersonateAccount(s.randomWhitelist1[i])
      let signer = ethers.provider.getSigner(s.randomWhitelist1[i])

      await s.USDC.connect(signer).approve(Wave.address, claimAmount)
      await mineBlock()

      await Wave.connect(signer).getPoints(
        1,
        claimAmount,
        key1,
        merkleProof
      )
      await mineBlock()
      await ceaseImpersonation(s.randomWhitelist1[i])

    }
  })

  it("1 more claim to reach cap", async () => {
    const cap = await Wave._cap()
    let totalClaimed = await Wave._totalClaimed()

    //expect(totalClaimed).to.be.lt(cap) //cap has not been reached
    const claimableAmount = cap.sub(totalClaimed)

    const finalClaimer = ethers.provider.getSigner(s.whitelist1[0])
    await s.USDC.connect(s.Bank).transfer(finalClaimer._address, claimableAmount)
    await advanceBlockHeight(1)

    //merkle things
    let leaf = solidityKeccak256(["address", "uint256"], [finalClaimer._address, key1])
    let merkleProof = merkleTree1.getHexProof(leaf)

    await impersonateAccount(finalClaimer._address)

    await s.USDC.connect(finalClaimer).approve(Wave.address, claimableAmount)
    await mineBlock()

    await Wave.connect(finalClaimer).getPoints(
      1,
      claimableAmount,
      key1,
      merkleProof
    )
    await mineBlock()

    await ceaseImpersonation(finalClaimer._address)
  })

  it("Cap is reached, nobody is able to claim more", async () => {
    const cap = await Wave._cap()
    let totalClaimed = await Wave._totalClaimed()
    expect(totalClaimed).to.be.eq(cap) //cap has not been reached

    const failedClaimer = ethers.provider.getSigner(s.whitelist1[1])
    await s.USDC.connect(s.Bank).transfer(failedClaimer._address, amount)
    await advanceBlockHeight(1)

    //merkle things
    let leaf = solidityKeccak256(["address", "uint256"], [failedClaimer._address, key1])
    let merkleProof = merkleTree1.getHexProof(leaf)

    await impersonateAccount(failedClaimer._address)

    await s.USDC.connect(failedClaimer).approve(Wave.address, amount)
    await mineBlock()

    await expect(Wave.connect(failedClaimer).getPoints(
      1,
      amount,
      key1,
      merkleProof
    )).to.be.revertedWith("Cap reached")
    await mineBlock()

    await ceaseImpersonation(failedClaimer._address)
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

  it("Cap is reached, nobody is able to claim more", async () => {
    const cap = await Wave._cap()
    let totalClaimed = await Wave._totalClaimed()
    expect(totalClaimed).to.be.eq(cap) //cap has not been reached

    const failedClaimer = ethers.provider.getSigner(s.whitelist1[1])
    await s.USDC.connect(s.Bank).transfer(failedClaimer._address, amount)
    await advanceBlockHeight(1)

    //merkle things
    let leaf = solidityKeccak256(["address", "uint256"], [failedClaimer._address, key1])
    let merkleProof = merkleTree1.getHexProof(leaf)

    await impersonateAccount(failedClaimer._address)

    await s.USDC.connect(failedClaimer).approve(Wave.address, amount)
    await mineBlock()

    await expect(Wave.connect(failedClaimer).getPoints(
      1,
      amount,
      key1,
      merkleProof
    )).to.be.revertedWith("Cap reached")
    await mineBlock()

    await ceaseImpersonation(failedClaimer._address)
  })
})//wave 2 claims

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
    expect(totalClaimed).to.be.eq(cap) //cap has been reached

    const failedClaimer = ethers.provider.getSigner(s.whitelist1[1])
    await s.USDC.connect(s.Bank).transfer(failedClaimer._address, amount)
    await advanceBlockHeight(1)

    //merkle things
    let leaf = solidityKeccak256(["address", "uint256"], [failedClaimer._address, key1])
    let merkleProof = merkleTree1.getHexProof(leaf)

    await impersonateAccount(failedClaimer._address)

    await s.USDC.connect(failedClaimer).approve(Wave.address, amount)
    await mineBlock()

    await expect(Wave.connect(failedClaimer).getPoints(
      1,
      amount,
      key1,
      merkleProof
    )).to.be.revertedWith("Cap reached")
    await mineBlock()

    await ceaseImpersonation(failedClaimer._address)

  })
  it("Check receiver balance", async () => {
    let receiverBalance = await s.USDC.balanceOf(s.Carol.address)
    const cap = await Wave._cap()

    expect(receiverBalance).to.be.gt(cap.sub(1))
  })
})

describe("Redemptions", () => {
  it("try to redeem before redemption time", async () => {
    const redeemer = ethers.provider.getSigner(s.whitelist1[1])
    await s.USDC.connect(s.Bank).transfer(redeemer._address, amount)
    await advanceBlockHeight(1)

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
    for (let i = 0; i < s.randomWhitelist1.length; i++) {
      showBody(`redeeming ${i} of ${s.randomWhitelist1.length}`)
      let redeemed = (await Wave._data(1, s.randomWhitelist1[i])).redeemed
      let claimed = ((await Wave._data(1, s.randomWhitelist1[i])).claimed)

      if (!redeemed && claimed.toNumber() > 0) {
        await impersonateAccount(s.randomWhitelist1[i])
        let signer = ethers.provider.getSigner(s.randomWhitelist1[i])

        await Wave.connect(signer).redeem(1)
        await mineBlock()

        await ceaseImpersonation(s.randomWhitelist1[i])
      }
    }
  })

  it("Try to redeem again", async () => {
    await impersonateAccount(s.randomWhitelist1[0])
    let signer = ethers.provider.getSigner(s.randomWhitelist1[0])

    await expect(Wave.connect(signer).redeem(1)).to.be.revertedWith("already redeem")
    await mineBlock()

    await ceaseImpersonation(s.randomWhitelist1[0])

  })

  it("All redemptions done: ", async () => {
    const finalRedeemer = ethers.provider.getSigner(s.whitelist1[0])
    let redeemed = (await Wave._data(1, finalRedeemer._address)).redeemed
    let claimed = ((await Wave._data(1, finalRedeemer._address)).claimed)


    if (!redeemed && claimed.toNumber() > 0) {
      await impersonateAccount(finalRedeemer._address)
      await Wave.connect(finalRedeemer).redeem(1)
      await mineBlock()

      await ceaseImpersonation(finalRedeemer._address)
    }

    let remainingIPT = await s.IPT.balanceOf(Wave.address)
    expect(remainingIPT).to.eq(0)//All IPT has been claimed
  })

  it("try admin withdraw", async () => {
    await expect(Wave.connect(s.Carol).withdraw()).to.be.revertedWith("Saturation reached")
    await mineBlock()
  })
})

describe("Check IPT received: ", () => {
  let balance: BigNumber
  it("Check wave IPT", async () => {
    balance = await s.IPT.balanceOf(Wave.address)
    expect(balance).to.eq(0)//All wave IPT has been claimed and redeemed
  })

  it("Check IPT of wave 1 claimer", async () => {

    let claimed = ((await Wave._data(1, s.randomWhitelist1[5])).claimed)
    balance = await s.IPT.balanceOf(s.randomWhitelist1[5])

    //ceiling price of 2.0 USDC per IPT has been reached
    expect(claimed.div(BN("1e6")).toNumber()).to.eq(await toNumber(balance.mul(2)))
  })
})

