import { BigNumber } from "ethers";
import { IERC20, INonfungiblePositionManager__factory, IUniV3Pool__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { oa } from "./addresser";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { currentBlock, hardhat_mine_timed } from "./block";
import { MintParams } from "../test/cap/cappedUniV3Position/scope";
import { BN } from "./number";
import { getArgs } from "./math";

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

  const nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, minter)
  const result = await nfpManager.connect(minter).mint(params)
  await hardhat_mine_timed(500, 15)
  const args = await getArgs(result)
  return args.tokenId
}