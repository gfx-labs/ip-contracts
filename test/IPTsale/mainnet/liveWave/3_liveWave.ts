import { s } from "../scope"
import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../../../util/format"
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"
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
import { ethers, network, tenderly } from "hardhat";

import { currentBlock, reset } from "../../../../util/block"
import MerkleTree from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"
import {
  IERC20__factory,
  InterestProtocolTokenDelegate,
  InterestProtocolTokenDelegate__factory,
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

let root1: string
let root2: string
let merkleTree1: MerkleTree
let merkleTree2: MerkleTree
const key1 = BN("1000000e6") //1,000,000 USDC
const key2 = BN("500000e6") //500,000 USDC
const floor = BN("250000") //0.25 USDC
const amount = BN("100e6") //100 USDC
//const totalReward = utils.parseEther("30000000")//30,000,000 IPT 
let totalReward: BigNumber
let Wave: WavePool

let startingUSDC: BigNumber

const wave1ClaimsTotal = BN("2000000e6")//2MM USDC
const wave2ClaimsTotal = BN("3000000e6")//3MM USDC
const wave3ClaimsTotal = BN("3000000e6")//4mm USDC

require("chai").should()
describe("Test live deployment of wave contract", () => {
  before(async () => {
    await initMerkle()
  })

  it("connect to Wavepool and IPT contracts", async () => {
    Wave = WavePool__factory.connect(s.waveDeploy, s.Frank)
    s.IPT = InterestProtocolTokenDelegate__factory.connect(s.IPTDelegator, s.Frank)

    let iptBalance = await s.IPT.balanceOf(s.iptHolder)
    expect(iptBalance).to.equal(await s.IPT.totalSupply())//iptHolder hods all of the IPTs in supply
    totalReward = await Wave._totalReward()

    s.waveReceiver = await Wave._receiver()
    startingUSDC = await s.USDC.balanceOf(s.waveReceiver)
    showBodyCyan(startingUSDC)


    //transfer IPT to Wave contract
    await impersonateAccount(s.iptHolder)
    let iptSigner = await ethers.getSigner(s.iptHolder)
    await s.IPT.connect(iptSigner).transfer(Wave.address, totalReward)
    await mineBlock()
    await ceaseImpersonation(s.iptHolder)

  })

  it("Sanity check state of Wave contract", async () => {
    //check roots
    const data1 = await Wave._metadata(1)
    const readRoot1 = data1.merkleRoot
    expect(readRoot1).to.eq(root1)

    const data2 = await Wave._metadata(2)
    const readRoot2 = data2.merkleRoot
    expect(readRoot2).to.eq(root2)

    const claimedTotal = await Wave._totalClaimed()
    assert.equal(claimedTotal.toString(), "0", "Total claimed is 0 (correct)")

    const Readfloor = await Wave._floor()
    assert.equal(Readfloor.toNumber(), floor.toNumber(), "Floor is correct")

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
  it("Fast forward to enable wave 1", async () => {

    let enabled = await Wave.isEnabled(1)
    expect(enabled).to.eq(false)

    await nextBlockTime(s.wave1start)
    await mineBlock()

    enabled = await Wave.isEnabled(1)
    expect(enabled).to.eq(true)

  })

  it("A few claims in wave 1, do not reach saturation", async () => {
    let cap = await Wave._cap()
    let total = await Wave._totalClaimed()
    expect(total).to.be.lt(cap) //cap has not been reached

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
      showBody(`claiming ${i} of ${s.randomWhitelist1.length}`)

      //merkle things
      let leaf = solidityKeccak256(["address", "uint256"], [s.randomWhitelist1[i], key1])
      let merkleProof = merkleTree1.getHexProof(leaf)

      await s.Bank.sendTransaction({ to: s.randomWhitelist1[i], value: utils.parseEther("0.5") })//gas to claim
      await advanceBlockHeight(1)

      await s.USDC.connect(s.Bank).transfer(s.randomWhitelist1[i], claimAmount)//USDC to claim 
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

  it("Confirm wave 1 claimed the correct amount", async () => {
    const claimedTotal = await Wave._totalClaimed()
    expect(claimedTotal).to.be.closeTo(wave1ClaimsTotal, BN("75e6"))
  })
})

describe("Wave 2 claims", () => {
  it("advance time to enable wave 2", async () => {
    let enabled = await Wave.isEnabled(BN("2"))
    assert.equal(enabled, false, "Wave 2 is not yet enabled")

    await nextBlockTime(s.wave2start)
    await mineBlock()

    enabled = await Wave.isEnabled(BN("2"))
    assert.equal(enabled, true, "Wave 2 is now enabled")
  })

  it("Wave 2 claims", async () => {
    let cap = await Wave._cap()
    let total = await Wave._totalClaimed()
    expect(total).to.be.lt(cap) //cap has not been reached
    const claimableAmount = wave2ClaimsTotal
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
})

describe("Wave 3 claims", () => {
  it("advance time to enable wave 3", async () => {
    let enabled = await Wave.isEnabled(BN("3"))
    assert.equal(enabled, false, "Wave 3 is not yet enabled")

    await nextBlockTime(s.wave3start)
    await mineBlock()

    enabled = await Wave.isEnabled(BN("3"))
    assert.equal(enabled, true, "Wave 3 is now enabled")
  })

  it("Wave 3 claims", async () => {
    //merkle things - not needed for wave 3
    let leaf = solidityKeccak256(["address", "uint256"], [s.randomWhiteList3[0], key2])
    let merkleProof = merkleTree2.getHexProof(leaf)

    let cap = await Wave._cap()
    let total = await Wave._totalClaimed()
    expect(total).to.be.lt(cap) //cap has not been reached
    const claimableAmount = wave3ClaimsTotal
    const formatClaimable = claimableAmount.div(BN("1e6"))
    const FormatUsdcAmount = Math.floor(formatClaimable.toNumber() / s.randomWhiteList3.length)//everyone claims this much to reach cap
    const rawUSDCamount = FormatUsdcAmount * 1000000
    let claimAmount = rawUSDCamount

    for (let i = 0; i < s.randomWhiteList3.length; i++) {
      showBody(`claiming ${i} of ${s.randomWhiteList3.length} in wave 3`)

      await s.Bank.sendTransaction({ to: s.randomWhiteList3[i], value: utils.parseEther("0.5") })
      await advanceBlockHeight(1)

      await s.USDC.connect(s.Bank).transfer(s.randomWhiteList3[i], claimAmount)
      await advanceBlockHeight(1)

      await impersonateAccount(s.randomWhiteList3[i])
      let signer = ethers.provider.getSigner(s.randomWhiteList3[i])

      await s.USDC.connect(signer).approve(Wave.address, claimAmount)
      await mineBlock()

      await Wave.connect(signer).getPoints(
        3,
        claimAmount,
        key2,//not checked in wave 3
        merkleProof//not checked in wave 3
      )
      await mineBlock()

      await ceaseImpersonation(s.randomWhiteList3[i])
    }
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

  it("advance time to enable redeem", async () => {
    let enabled = await Wave.canRedeem()
    assert.equal(enabled, false, "Not yet redeem time")

    await nextBlockTime(s.claimTime)
    await mineBlock()

    enabled = await Wave.canRedeem()
    assert.equal(enabled, true, "Redeem time now active")
  })

  it("All redemptions done", async () => {

    //wave 1
    for (let i = 0; i < s.randomWhitelist1.length; i++) {
      showBody(`redeeming wave 1:  ${i} of ${s.randomWhitelist1.length}`)
      const wave = 1
      let redeemed = (await Wave._data(wave, s.randomWhitelist1[i])).redeemed
      let claimed = ((await Wave._data(wave, s.randomWhitelist1[i])).claimed)

      if (!redeemed && claimed.toNumber() > 0) {
        await impersonateAccount(s.randomWhitelist1[i])
        let signer = ethers.provider.getSigner(s.randomWhitelist1[i])

        await Wave.connect(signer).redeem(wave)
        await mineBlock()

        await ceaseImpersonation(s.randomWhitelist1[i])
      }
    }

    //wave 2
    for (let i = 0; i < s.randomWhitelist2.length; i++) {
      showBody(`redeeming wave 2:  ${i} of ${s.randomWhitelist2.length}`)
      const wave = 2
      let redeemed = (await Wave._data(wave, s.randomWhitelist2[i])).redeemed
      let claimed = ((await Wave._data(wave, s.randomWhitelist2[i])).claimed)

      if (!redeemed && claimed.toNumber() > 0) {
        await impersonateAccount(s.randomWhitelist2[i])
        let signer = ethers.provider.getSigner(s.randomWhitelist2[i])

        await Wave.connect(signer).redeem(wave)
        await mineBlock()

        await ceaseImpersonation(s.randomWhitelist2[i])
      }
    }

    //wave 3
    for (let i = 0; i < s.randomWhiteList3.length; i++) {
      showBody(`redeeming wave 3:  ${i} of ${s.randomWhiteList3.length}`)
      const wave = 3
      let redeemed = (await Wave._data(wave, s.randomWhiteList3[i])).redeemed
      let claimed = ((await Wave._data(wave, s.randomWhiteList3[i])).claimed)

      if (!redeemed && claimed.toNumber() > 0) {
        await impersonateAccount(s.randomWhiteList3[i])
        let signer = ethers.provider.getSigner(s.randomWhiteList3[i])

        await Wave.connect(signer).redeem(wave)
        await mineBlock()

        await ceaseImpersonation(s.randomWhiteList3[i])
      }
    }
  })

  it("try admin withdraw", async () => {
    const admin = await ethers.getSigner(s.waveReceiver)
    let adminIPT = await s.IPT.balanceOf(s.waveReceiver)
    expect(adminIPT).to.eq(0)//admin has 0 IPT

    await impersonateAccount(admin.address)
    await Wave.connect(admin).withdraw()
    await mineBlock()
    await ceaseImpersonation(admin.address)

    adminIPT = await s.IPT.balanceOf(admin.address)
    expect(adminIPT).to.be.gt(0)//admin received unclaimed
  })

  it("Check receiver balance", async () => {
    let receiverBalance = await s.USDC.balanceOf(s.waveReceiver)
    expect(receiverBalance.sub(startingUSDC)).to.be.closeTo(wave1ClaimsTotal.add(wave2ClaimsTotal).add(wave3ClaimsTotal), BN("100e6"))

    let remainingIPT = await s.IPT.balanceOf(Wave.address)
    expect(remainingIPT).to.eq(0)//All IPT is redeemed and withdrawn 
  })
})


