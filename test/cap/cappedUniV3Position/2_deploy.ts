import { s, MintParams } from "./scope"
import { ethers } from "hardhat"
import { showBody, showBodyCyan } from "../../../util/format"
import { BN } from "../../../util/number"
import { fastForward, mineBlock, hardhat_mine, hardhat_mine_timed } from "../../../util/block"
import { BigNumber } from "ethers"
import { currentBlock } from "../../../util/block"
import { expect } from "chai"
import { toNumber, getGas, getArgs } from "../../../util/math"

import {
  IVault__factory, Univ3CollateralToken__factory,
  NftVaultController__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegate,
  OracleMaster__factory,
  VaultController__factory,
  V3PositionValuator__factory,
  IUniV3Pool__factory,
  ProxyAdmin__factory
} from "../../../typechain-types"
import { DeployContractWithProxy } from "../../../util/deploy"
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator"

import {
  abi as POOL_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import {
  nearestUsableTick
} from '@uniswap/v3-sdk'
import { ProposalContext } from "../../../scripts/proposals/suite/proposal"
const nfpManagerAddr = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"

require("chai").should()
describe("Check Interest Protocol contracts", () => {
  describe("Sanity check USDi deploy", () => {
    it("Should return the right name, symbol, and decimals", async () => {

      expect(await s.USDI.name()).to.equal("USDI Token")
      expect(await s.USDI.symbol()).to.equal("USDI")
      expect(await s.USDI.decimals()).to.equal(18)
    })
  })

  describe("Sanity check VaultController deploy", () => {
    it("Check data on VaultControler", async () => {
      let tokensRegistered = await s.VaultController.tokensRegistered()
      expect(tokensRegistered).to.be.gt(0)
      let interestFactor = await s.VaultController.interestFactor()
      expect(await toNumber(interestFactor)).to.be.gt(1)
    })

    it("Mint vault for Bob", async () => {
      await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
        .reverted
      await mineBlock()
      s.BobVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
      s.BobVault = IVault__factory.connect(vaultAddress, s.Bob)
      expect(await s.BobVault.minter()).to.eq(s.Bob.address)
    })

    it("Mint vault for Carol", async () => {

      const result = await s.VaultController.connect(s.Carol).mintVault()
      const gas = await getGas(result)
      showBodyCyan("Gas to mint standard vault: ", gas)

      s.CaroLVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
      s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol)
      expect(await s.CarolVault.minter()).to.eq(s.Carol.address)
    })
  })
})


describe("Mint position", () => {
  it("Approve", async () => {
    await s.WBTC.connect(s.Bob).approve(nfpManagerAddr, s.wBTC_Amount)
    await s.WETH.connect(s.Bob).approve(nfpManagerAddr, s.WETH_AMOUNT)

    await s.WBTC.connect(s.Carol).approve(nfpManagerAddr, s.wBTC_Amount)
    await s.WETH.connect(s.Carol).approve(nfpManagerAddr, s.WETH_AMOUNT)
  })

  it("Mint position for Bob", async () => {
    const startWeth = await s.WETH.balanceOf(s.Bob.address)
    const startWbtc = await s.WBTC.balanceOf(s.Bob.address)

    s.POOL = IUniV3Pool__factory.connect(s.POOL_ADDR, s.Frank)

    const [fee, tickSpacing, slot0] =
      await Promise.all([
        s.POOL.fee(),
        s.POOL.tickSpacing(),
        s.POOL.slot0(),
      ])

    const nut = nearestUsableTick(slot0[1], tickSpacing)
    const tickLower = nut - (tickSpacing * 2)
    const tickUpper = nut + (tickSpacing * 2)

    const block = await currentBlock()

    const params: MintParams = {
      token0: s.WBTC.address,
      token1: s.WETH.address,
      fee: fee,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: s.wBTC_Amount,
      amount1Desired: s.WETH_AMOUNT,
      amount0Min: BN("0"),
      amount1Min: BN("0"),
      recipient: s.Bob.address,
      deadline: block.timestamp + 500
    }
    //mint position
    const result = await s.nfpManager.connect(s.Bob).mint(params)
    await hardhat_mine_timed(500, 15)
    const args = await getArgs(result)

    const tokenId = args.tokenId
    s.BobPositionId = tokenId
    expect(await s.nfpManager.balanceOf(s.Bob.address)).to.eq(BN("1"), "Bob has 1 NFT")

    const endWeth = await s.WETH.balanceOf(s.Bob.address)
    const endWbtc = await s.WBTC.balanceOf(s.Bob.address)

    expect(startWbtc.sub(endWbtc)).to.eq(args.amount0, "Expected amount of wBTC taken")
    expect(startWeth.sub(endWeth)).to.eq(args.amount1, "Expected amount of wETH taken")

    s.BobAmount0 = args.amount0
    s.BobAmount1 = args.amount1

  })

  it("Mint position for Carol", async () => {


    const startWeth = await s.WETH.balanceOf(s.Carol.address)
    const startWbtc = await s.WBTC.balanceOf(s.Carol.address)


    s.poolContract = new ethers.Contract(
      s.POOL_ADDR,
      POOL_ABI,
      ethers.provider
    )
    const [fee, tickSpacing, slot0] =
      await Promise.all([
        s.poolContract.fee(),
        s.poolContract.tickSpacing(),
        s.poolContract.slot0(),
      ])

    const nut = nearestUsableTick(slot0[1], tickSpacing)
    const tickLower = nut - (tickSpacing * 2)
    const tickUpper = nut + (tickSpacing * 2)

    const block = await currentBlock()

    const params: MintParams = {
      token0: s.WBTC.address,
      token1: s.WETH.address,
      fee: fee,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: s.wBTC_Amount,
      amount1Desired: s.WETH_AMOUNT,
      amount0Min: BN("0"),
      amount1Min: BN("0"),
      recipient: s.Carol.address,
      deadline: block.timestamp + 500
    }

    //mint position
    const result = await s.nfpManager.connect(s.Carol).mint(params)
    await hardhat_mine_timed(500, 15)
    const args = await getArgs(result)
    const tokenId = args.tokenId
    s.CarolPositionId = tokenId
    expect(await s.nfpManager.balanceOf(s.Carol.address)).to.eq(BN("1"), "Carol has 1 NFT")


    const endWeth = await s.WETH.balanceOf(s.Carol.address)
    const endWbtc = await s.WBTC.balanceOf(s.Carol.address)

    expect(startWbtc.sub(endWbtc)).to.eq(args.amount0, "Expected amount of wBTC taken")
    expect(startWeth.sub(endWeth)).to.eq(args.amount1, "Expected amount of wETH taken")

    s.CarolAmount0 = args.amount0
    s.CarolAmount1 = args.amount1

  })

  it("Reset approvals", async () => {
    //reset previous weth approval
    await s.WETH.connect(s.Carol).approve(nfpManagerAddr, BN("0"))

    await hardhat_mine_timed(500, 15)
    let usdcApproval = await s.USDC.allowance(s.Carol.address, s.nfpManager.address)
    let wethApproval = await s.WETH.allowance(s.Carol.address, s.nfpManager.address)

    expect(usdcApproval).to.eq(0, "USDC approval is 0")
    expect(wethApproval).to.eq(0, "WETH approval is 0")

    await s.USDC.connect(s.Carol).approve(nfpManagerAddr, s.USDC_AMOUNT)
    await s.WETH.connect(s.Carol).approve(nfpManagerAddr, s.WETH_AMOUNT)

    usdcApproval = await s.USDC.allowance(s.Carol.address, s.nfpManager.address)
    wethApproval = await s.WETH.allowance(s.Carol.address, s.nfpManager.address)

    expect(usdcApproval).to.eq(s.USDC_AMOUNT, "USDC approval is correct")
    expect(wethApproval).to.eq(s.WETH_AMOUNT, "WETH approval is correct")
    await hardhat_mine_timed(500, 15)

  })

  it("Mint another position for Carol for a pool that is not registered", async () => {
    const illegalPool = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8" //USDC/wETH/3000
    const poolContract = new ethers.Contract(
      illegalPool,
      POOL_ABI,
      ethers.provider
    )

    const [fee, tickSpacing, slot0] =
      await Promise.all([
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.slot0(),
      ])
    const nut = nearestUsableTick(slot0[1], tickSpacing)
    const tickLower = nut - (tickSpacing * 2)
    const tickUpper = nut + (tickSpacing * 2)

    const block = await currentBlock()

    const params: MintParams = {
      token0: s.USDC.address,
      token1: s.WETH.address,
      fee: fee,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: s.USDC_AMOUNT,
      amount1Desired: s.WETH_AMOUNT,
      amount0Min: BN("0"),
      amount1Min: BN("0"),
      recipient: s.Carol.address,
      deadline: block.timestamp + 500
    }
    //mint position
    const result = await s.nfpManager.connect(s.Carol).mint(params)
    await hardhat_mine_timed(500, 15)
    const args = await getArgs(result)
    const tokenId = args.tokenId
    s.CarolIllegalPositionId = tokenId
    expect(await s.nfpManager.balanceOf(s.Carol.address)).to.eq(BN("2"), "Carol has a second NFT")
  })
})

describe("deploy oracles and cap tokens", () => {
  it("deploly oracles", async () => {

    s.PositionValuator = await DeployContractWithProxy(
      new V3PositionValuator__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",//nfpManager
      "0x1F98431c8aD98523631AE4a59f267346ea31F984" //Factory v3     
    )
    await s.PositionValuator.deployed()

    await s.PositionValuator.registerPool(s.POOL_ADDR, s.wbtcOracle.address, s.wethOracle.address)

  })

  it("Deploy nft vault controller", async () => {
    s.NftVaultController = await DeployContractWithProxy(
      new NftVaultController__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      s.VaultController.address
    )
    await s.NftVaultController.deployed()
    await s.NftVaultController.transferOwnership(s.GOV._address)
  })

  it("Deploy cap token", async () => {

    s.WrappedPosition = await DeployContractWithProxy(
      new Univ3CollateralToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "Capped V3 Position",
      "cV3Pos",
      nfpManagerAddr,
      s.VaultController.address,
      s.NftVaultController.address,
      s.PositionValuator.address
    )
    await s.WrappedPosition.deployed()
  })
})

describe("Setup, Queue and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 "
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate

  let proposal: number

  let out: any

  before(async () => {
    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    )
  })

  it("Makes the proposal", async () => {
    const proposal = new ProposalContext("Uni V3 Position")

    const addOracle = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.WrappedPosition.address,
        s.PositionValuator.address
      )

    const list = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.WrappedPosition.address,
        s.LTV,
        s.WrappedPosition.address,
        s.LiquidationIncentive
      )

    const registerNftController = await new NftVaultController__factory(prop).
      attach(s.NftVaultController.address).
      populateTransaction.registerUnderlying(s.WrappedPosition.address, nfpManagerAddr)

    //deploy upgraded vault controller
    const implementation = await new VaultController__factory(s.Frank).deploy()
    await implementation.deployed()

    //upgrade vault controller
    const upgrade = await new ProxyAdmin__factory(s.GOV).attach(s.ProxyAdmin.address).
      populateTransaction.upgrade(s.VaultController.address, implementation.address)

    //set position wrapper on vault controller
    const setPositionWrapper = await new VaultController__factory(s.GOV).
      attach(s.VaultController.address).populateTransaction.
      setPositionWrapperAddress(s.WrappedPosition.address)

    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerNftController, "registerUnderlying(address,address)")
    proposal.addStep(upgrade, "upgrade(address,address)")
    proposal.addStep(setPositionWrapper, "setPositionWrapperAddress(address)")

    out = proposal.populateProposal()

  })
  it("queue and execute", async () => {
    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
    expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")

    await impersonateAccount(proposer)
    await gov.connect(prop).propose(
      out.targets,
      out.values,
      out.signatures,
      out.calldatas,
      "B-stETH-STABLE-gauge",
      false
    )
    await mineBlock()
    proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber())

    await gov.connect(prop).castVote(proposal, 1)
    await mineBlock()

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())
    await mineBlock()

    await gov.connect(prop).queue(proposal)
    await mineBlock()

    await fastForward(timelock.toNumber())
    await mineBlock()

    await gov.connect(prop).execute(proposal)
    await mineBlock()


    await ceaseImpersonation(proposer)
  })
})
