// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

import "../_external/uniswap/TickMath.sol";

import "hardhat/console.sol";

interface ITestPool {
  function fee() external view returns (uint24);

  function swap(
    address recipient,
    bool zeroForOne,
    int256 amountSpecified,
    uint160 sqrtPriceLimitX96,
    bytes calldata data
  ) external returns (int256 amount0, int256 amount1);
}

contract UniSwap {
  function doSwap(address _pool, bool zeroForOne, int256 amountIn) external {
    ITestPool pool = ITestPool(_pool);

    console.log("DOING SWAP", _pool);
    console.log("Fee: ", pool.fee());
    pool.swap(
      msg.sender, //send tokens directly to vault, increasing borrowing power and saving us a transfer in gas
      zeroForOne,
      amountIn, //amount specified
      (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1),
      abi.encode("0x")
    );
  }
}
