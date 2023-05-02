// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

interface INonfungiblePositionManager {
  struct MintParams {
    address token0;
    address token1;
    uint24 fee;
    int24 tickLower;
    int24 tickUpper;
    uint256 amount0Desired;
    uint256 amount1Desired;
    uint256 amount0Min;
    uint256 amount1Min;
    address recipient;
    uint256 deadline;
  }

  struct IncreaseLiquidityParams {
    uint256 tokenId;
    uint256 amount0Desired;
    uint256 amount1Desired;
    uint256 amount0Min;
    uint256 amount1Min;
    uint256 deadline;
  }

  struct DecreaseLiquidityParams {
    uint256 tokenId;
    uint128 liquidity;
    uint256 amount0Min;
    uint256 amount1Min;
    uint256 deadline;
  }

  struct CollectParams {
    uint256 tokenId;
    address recipient;
    uint128 amount0Max;
    uint128 amount1Max;
  }

  /**
    nonce	uint96	The nonce for permits
    operator	address	The address that is approved for spending
    token0	address	The address of the token0 for a specific pool
    token1	address	The address of the token1 for a specific pool
    fee	uint24	The fee associated with the pool
    tickLower	int24	The lower end of the tick range for the position
    tickUpper	int24	The higher end of the tick range for the position
    liquidity	uint128	The liquidity of the position
    feeGrowthInside0LastX128	uint256	The fee growth of token0 as of the last action on the individual position
    feeGrowthInside1LastX128	uint256	The fee growth of token1 as of the last action on the individual position
    tokensOwed0	uint128	The uncollected amount of token0 owed to the position as of the last computation
    tokensOwed1	uint128	The uncollected amount of token1 owed to the position as of the last computation
    */
  function positions(
    uint256 tokenId
  )
    external
    view
    returns (
      uint96 nonce,
      address operator,
      address token0,
      address token1,
      uint24 fee,
      int24 tickLower,
      int24 tickUpper,
      uint128 liquidity,
      uint256 feeGrowthInside0LastX128,
      uint256 feeGrowthInside1LastX128,
      uint128 tokensOwed0,
      uint128 tokensOwed1
    );

  ///@param sqrtPriceX96 The initial square root price of the pool as a Q64.96 value
  function createAndInitializePoolIfNecessary(
    address tokenA,
    address tokenB,
    uint24 fee,
    uint160 sqrtPriceX96
  ) external payable returns (address pool);

  function mint(
    MintParams calldata params
  ) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

  function increaseLiquidity(
    IncreaseLiquidityParams calldata params
  ) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1);

  function decreaseLiquidity(
    DecreaseLiquidityParams calldata params
  ) external payable returns (uint256 amount0, uint256 amount1);

  function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);

  function burn(uint256 tokenId) external payable;
}
