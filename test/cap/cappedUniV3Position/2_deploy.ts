import { s } from "./scope";
import { d } from "../DeploymentInfo";
import { upgrades, ethers } from "hardhat";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear, hardhat_mine } from "../../../util/block";
import { utils, BigNumber, BigNumberish } from "ethers";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber, getGas, getArgs } from "../../../util/math"
import { stealMoney } from "../../../util/money";

import {
  AnchoredViewRelay__factory,
  BPT_WEIGHTED_ORACLE__factory,
  CappedBptToken__factory,
  IOracleRelay,
  IVault__factory,
  UniswapV3TokenOracleRelay__factory,
  VaultBPT__factory,
  WstETHRelay__factory,
  RateProofOfConcept__factory,
  IOracleRelay__factory,
  BPTstablePoolOracle__factory,
  INFPmanager__factory,
  INonfungiblePositionManager__factory,
  UniV3LPoracle__factory
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
import { PromiseOrValue } from "../../../typechain-types/common";

import {
  abi as FACTORY_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import {
  abi as POOL_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import {
  abi as ROUTERV3,
} from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"
import {
  MintOptions,
  nearestUsableTick,
  NonfungiblePositionManager,
  Pool,
  Position,
} from '@uniswap/v3-sdk'
const nfpManagerAddr = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const wETHwBTC_pool_addr = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"

require("chai").should();
describe("Check Interest Protocol contracts", () => {
  describe("Sanity check USDi deploy", () => {
    it("Should return the right name, symbol, and decimals", async () => {

      expect(await s.USDI.name()).to.equal("USDI Token");
      expect(await s.USDI.symbol()).to.equal("USDI");
      expect(await s.USDI.decimals()).to.equal(18);
      //expect(await s.USDI.owner()).to.equal(s.Frank.address);
      //s.owner = await s.USDI.owner()
      s.pauser = await s.USDI.pauser()
    });
  });

  describe("Sanity check VaultController deploy", () => {
    it("Check data on VaultControler", async () => {
      let tokensRegistered = await s.VaultController.tokensRegistered()
      expect(tokensRegistered).to.be.gt(0)
      let interestFactor = await s.VaultController.interestFactor()
      expect(await toNumber(interestFactor)).to.be.gt(1)

    });

    it("Mint vault for Bob", async () => {
      await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
        .reverted;
      await mineBlock();
      s.BobVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
      s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
      expect(await s.BobVault.minter()).to.eq(s.Bob.address);
    })

    it("Mint vault for Carol", async () => {

      const result = await s.VaultController.connect(s.Carol).mintVault()
      const gas = await getGas(result)
      showBodyCyan("Gas to mint standard vault: ", gas)

      s.CaroLVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
      s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
      expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
    })

    it("Mint voting vault for Carol", async () => {
      const result = await s.VotingVaultController.mintVault(s.CaroLVaultID)
      const gas = await getGas(result)
      showBodyCyan("Gas to mint standard voting vault: ", gas)
    })
  });
});

type MintParams = {
  token0: PromiseOrValue<string>,
  token1: PromiseOrValue<string>,
  fee: PromiseOrValue<BigNumberish>,
  tickLower: PromiseOrValue<BigNumberish>,
  tickUpper: PromiseOrValue<BigNumberish>,
  amount0Desired: PromiseOrValue<BigNumberish>,
  amount1Desired: PromiseOrValue<BigNumberish>,
  amount0Min: PromiseOrValue<BigNumberish>,
  amount1Min: PromiseOrValue<BigNumberish>,
  recipient: PromiseOrValue<string>,
  deadline: PromiseOrValue<BigNumberish>
}

describe("Mint position", () => {
  //const token0 = s.WBTC
  //const token1 = s.WETH
  it("Approve", async () => {
    await s.WBTC.connect(s.Bob).approve(nfpManagerAddr, s.wBTC_Amount)
    await s.WETH.connect(s.Bob).approve(nfpManagerAddr, s.WETH_AMOUNT)
  })

  it("Create instance of pool", async () => {
    const nfpManager = INonfungiblePositionManager__factory.connect(nfpManagerAddr, s.Frank)

    const poolContract = new ethers.Contract(
      wETHwBTC_pool_addr,
      POOL_ABI,
      ethers.provider
    )
    const [fee, tickSpacing, slot0] =
      await Promise.all([
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.slot0(),
      ])
    showBody(slot0)

    /**
       const pool = new Pool(
          token0,
          token1,
          fee,
          slot0[0],
          liquidity,
          slot0[1]
      )
     */



    const nut = nearestUsableTick(slot0[1], tickSpacing)
    const tickLower = nut - (tickSpacing * 2)
    const tickUpper = nut + (tickSpacing * 2)


    //const intermediary = await new TestContract__factory(s.Frank).deploy()
    //await intermediary.deployed()

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
    const result = await nfpManager.connect(s.Bob).mint(params)
    const args = await getArgs(result)
    const tokenId = args.tokenId
    await mineBlock()

    const manager = INFPmanager__factory.connect(nfpManagerAddr, s.Frank)
    const [
      nonce,
      operator,
      token0,
      token1,
      _fee,
      tLow,
      tUp,
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1
    ] = await nfpManager.positions(tokenId)
    /**
     const [nonce, operator, , , , , , , feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1] = await manager.positions(tokenId)

    showBody("TokensOwed0: ", tokensOwed0)
    showBody("TokensOwed1: ", tokensOwed1)
     */
    showBody("TokensOwed0: ", tokensOwed0)
    showBody("TokensOwed1: ", tokensOwed1)
    showBody("liquidity: ", await toNumber(liquidity))

  })
})

describe("deploy oracles and cap tokens", () => {
  let UniV3LPoracle: IOracleRelay

  it("deploly oracles", async () => {
    UniV3LPoracle = await new UniV3LPoracle__factory(s.Frank).deploy(
      wETHwBTC_pool_addr,
      s.wbtcOracle.address,
      s.wethOracle.address,
      await s.WBTC.decimals(),
      await s.WETH.decimals()
    )
    await UniV3LPoracle.deployed()

    showBody(await UniV3LPoracle.currentValue())
  })
})