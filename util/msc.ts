import { BigNumber } from "ethers";
import { IERC20, IERC20__factory, INonfungiblePositionManager, INonfungiblePositionManager__factory, IOracleRelay, IUniV3Pool__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { oa } from "./addresser";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { currentBlock, hardhat_mine_timed } from "./block";
import { MintParams } from "../test/cap/cappedUniV3Position/scope";
import { BN } from "./number";
import { getArgs, toNumber } from "./math";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { impersonateAccount } from "./impersonator";

export const mintPosition = async (
  poolAddress: string,
  token0: IERC20,
  token1: IERC20,
  amount0: BigNumber,
  amount1: BigNumber,
  minter: SignerWithAddress) => {

  //approve
  await token0.connect(minter).approve(oa.nfpManager, amount0)
  await token1.connect(minter).approve(oa.nfpManager, amount1)

  const pool = IUniV3Pool__factory.connect(poolAddress, minter)
  const [fee, tickSpacing, slot0] =
    await Promise.all([
      pool.fee(),
      pool.tickSpacing(),
      pool.slot0(),
    ])
  const nut = nearestUsableTick(slot0[1], tickSpacing)
  const tickLower = nut - (tickSpacing * 2)
  const tickUpper = nut + (tickSpacing * 2)

  const block = await currentBlock()

  const params: MintParams = {
    token0: token0.address,
    token1: token1.address,
    fee: fee,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0Desired: amount0,
    amount1Desired: amount1,
    amount0Min: BN("0"),
    amount1Min: BN("0"),
    recipient: minter.address,
    deadline: block.timestamp + 500
  }

  //const start0 = await token0.balanceOf(minter.address)
  //const start1 = await token1.balancOf(minter.address)


  const nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, minter)
  const result = await nfpManager.connect(minter).mint(params)

  //const delta0 = start0.sub(await token0.balanceOf(minter.address))
 // const delta1 = start0.sub(await token1.balanceOf(minter.address))

  //console.log("Delta0: ", await toNumber(delta0))
  //console.log("Delta1: ", await toNumber(delta1))

  await hardhat_mine_timed(500, 15)
  const args = await getArgs(result)
  return args.tokenId
}

export const valuePosition = async (
  poolAddress: string,
  positionId: number,
  oracle0: IOracleRelay,
  oracle1: IOracleRelay,
  nfpManager: INonfungiblePositionManager,
  signer: SignerWithAddress
) => {
  //get owner
  const ownerAddr = await nfpManager.ownerOf(positionId)

  //fund minter
  await setBalance(ownerAddr, BN("1e18"))

  //impersonate
  const owner = ethers.provider.getSigner(ownerAddr)
  await impersonateAccount(ownerAddr)

  let data = await nfpManager.positions(positionId)

  const token0: IERC20 = IERC20__factory.connect(data.token0, signer)
  const token1: IERC20 = IERC20__factory.connect(data.token1, signer)

  //collect to reset value
  let collectParams = {
    tokenId: positionId,
    recipient: ownerAddr,
    amount0Max: data.tokensOwed0,
    amount1Max: data.tokensOwed1
  }
  if (data.tokensOwed0 > BN("0") || data.tokensOwed1 > BN("0")) {
    await nfpManager.connect(owner).collect(collectParams)
  }

  //get initial values
  const start0 = await token0.balanceOf(ownerAddr)
  const start1 = await token1.balanceOf(ownerAddr)

  //close position
  const params = {
    tokenId: positionId,
    liquidity: data.liquidity,
    amount0Min: BN("0"),
    amount1Min: BN("0"),
    deadline: (await currentBlock()).timestamp + 500
  }

  //reduce liquidity to 0
  await nfpManager.connect(owner).decreaseLiquidity(params)

  //collect all tokens
  data = await nfpManager.positions(positionId)
  collectParams = {
    tokenId: positionId,
    recipient: ownerAddr,
    amount0Max: data.tokensOwed0,
    amount1Max: data.tokensOwed1
  }
  await nfpManager.connect(owner).collect(collectParams)

  const tokne0Delta = (await token0.balanceOf(ownerAddr)).sub(start0)
  const token1Delta = (await token1.balanceOf(ownerAddr)).sub(start1)

  const value0 = ((await oracle0.currentValue()).mul(tokne0Delta))
  const value1 = ((await oracle1.currentValue()).mul(token1Delta))

  return (value0.add(value1)).div(BN("1e18"))

}