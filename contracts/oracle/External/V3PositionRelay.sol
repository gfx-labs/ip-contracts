// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/uniswap/IUniswapV3PoolDerivedState.sol";
import "../../_external/uniswap/TickMath.sol";
import {FullMath, FixedPoint96} from "../../_external/uniswap/FullMath.sol";

import "hardhat/console.sol";

/// based off of the MKR implementation https://github.com/makerdao/univ3-lp-oracle/blob/master/src/GUniLPOracle.sol

/**
GENERAL PLAN
Calculate sqrtPriceX96 based on external oracle prices - DONE
Calculate current tick based on sqrtRatio via TickMath - easy
Get tick upper and tick lower based on tick spacing, which comes from the pool (is this safe??)
Get sqrtTickUpper and sqrtTickLower from these based on TickMath
Get liquidity from NFP Manager (this is locked into the position)
Plug all of this into getAmountsForLiquidity to get tokenAmount0 and tokenAmount1
Use the same external oracles to price these amounts into USD
Profit??
 */

interface IUniswapV3PoolImmutables {
  /// @notice The pool tick spacing
  /// @dev Ticks can only be used at multiples of this value, minimum of 1 and always positive
  /// e.g.: a tickSpacing of 3 means ticks can be initialized every 3rd tick, i.e., ..., -6, -3, 0, 3, 6, ...
  /// This value is an int24 to avoid casting even though it is always positive.
  /// @return The tick spacing
  function tickSpacing() external view returns (int24);
}

contract V3PositionRelay is IOracleRelay {
  IUniswapV3PoolImmutables public immutable _pool;
  IOracleRelay public immutable token0Oracle;
  IOracleRelay public immutable token1Oracle;

  uint256 public immutable UNIT_0;
  uint256 public immutable UNIT_1;

  constructor(
    address pool_address,
    IOracleRelay _token0Oracle,
    IOracleRelay _token1Oracle,
    uint256 token0Units,
    uint256 token1Units
  ) {
    _pool = IUniswapV3PoolImmutables(pool_address);
    token0Oracle = _token0Oracle;
    token1Oracle = _token1Oracle;

    UNIT_0 = 10 ** token0Units;
    UNIT_1 = 10 ** token1Units;
  }

  function currentValue() external view override returns (uint256) {

    /**
    //todo refactor unit conversion
    console.log("1e18: ", 1e18);
    console.log("1e8 : ", 1e8);
    console.log("unt0: ", UNIT_0);
   */

    uint256 p0 = token0Oracle.currentValue() / 1e10;
    uint256 p1 = token1Oracle.currentValue();
    uint160 sqrtPriceX96 = getSqrtPrice(p0, p1);
    int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
    int24 tickSpacing = _pool.tickSpacing();

    int24 tickLower = tick - (tickSpacing * 2);
    int24 tickUpper = tick + (tickSpacing * 2);

    uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
    uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);

    //get liquidity
    (uint256 amount0, uint256 amount1) = getAmountsForLiquidity(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, 454860556043159);
    //console.log("AMOUNT0: ", amount0);
    //console.log("AMOUNT1: ", amount1);

    //derive value based on price
    uint256 v0 = (p0 * amount0) / 1e18;
    uint256 v1 = (p1 * amount1) / 1e18;

    //return v0 + v1;
    return 1e18;
  }

  /// @notice Computes the token0 and token1 value for a given amount of liquidity, the current
  /// pool prices and the prices at the tick boundaries
  function getAmountsForLiquidity(
    uint160 sqrtRatioX96,
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint128 liquidity
  ) internal pure returns (uint256 amount0, uint256 amount1) {
    if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);

    if (sqrtRatioX96 <= sqrtRatioAX96) {
      amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
    } else if (sqrtRatioX96 < sqrtRatioBX96) {
      amount0 = getAmount0ForLiquidity(sqrtRatioX96, sqrtRatioBX96, liquidity);
      amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioX96, liquidity);
    } else {
      amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
    }
  }

  /// @notice Computes the amount of token0 for a given amount of liquidity and a price range
  /// @param sqrtRatioAX96 A sqrt price
  /// @param sqrtRatioBX96 Another sqrt price
  /// @param liquidity The liquidity being valued
  /// @return amount0 The amount0
  function getAmount0ForLiquidity(
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint128 liquidity
  ) internal pure returns (uint256 amount0) {
    if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);

    return
      FullMath.mulDiv(uint256(liquidity) << FixedPoint96.RESOLUTION, sqrtRatioBX96 - sqrtRatioAX96, sqrtRatioBX96) /
      sqrtRatioAX96;
  }

  /// @notice Computes the amount of token1 for a given amount of liquidity and a price range
  /// @param sqrtRatioAX96 A sqrt price
  /// @param sqrtRatioBX96 Another sqrt price
  /// @param liquidity The liquidity being valued
  /// @return amount1 The amount1
  function getAmount1ForLiquidity(
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint128 liquidity
  ) internal pure returns (uint256 amount1) {
    if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);

    return FullMath.mulDiv(liquidity, sqrtRatioBX96 - sqrtRatioAX96, FixedPoint96.Q96);
  }

  /**
  //https://library.dedaub.com/ethereum/address/0xb54613678c36dd51e75236060060a13d44597d82/source?line=1129
    function getUnderlyingBalancesAtPrice(uint160 sqrtRatioX96)
        external
        view
        returns (uint256 amount0Current, uint256 amount1Current)
    {
        (, int24 tick, , , , , ) = pool.slot0();
        return _getUnderlyingBalances(sqrtRatioX96, tick);
    }

    function _getUnderlyingBalances(uint160 sqrtRatioX96, int24 tick)
        internal
        view
        returns (uint256 amount0Current, uint256 amount1Current)
    {
        (
            uint128 liquidity,
            uint256 feeGrowthInside0Last,
            uint256 feeGrowthInside1Last,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = pool.positions(_getPositionID());

        // compute current holdings from liquidity
        (amount0Current, amount1Current) = LiquidityAmounts
            .getAmountsForLiquidity(
            sqrtRatioX96,
            lowerTick.getSqrtRatioAtTick(),
            upperTick.getSqrtRatioAtTick(),
            liquidity
        );

        // compute current fees earned
        uint256 fee0 =
            _computeFeesEarned(true, feeGrowthInside0Last, tick, liquidity) +
                uint256(tokensOwed0);
        uint256 fee1 =
            _computeFeesEarned(false, feeGrowthInside1Last, tick, liquidity) +
                uint256(tokensOwed1);

        (fee0, fee1) = _subtractAdminFees(fee0, fee1);

        // add any leftover in contract to current holdings
        amount0Current +=
            fee0 +
            token0.balanceOf(address(this)) -
            managerBalance0 -
            gelatoBalance0;
        amount1Current +=
            fee1 +
            token1.balanceOf(address(this)) -
            managerBalance1 -
            gelatoBalance1;
    }
   */

  //tested accuracy: 0.15363% decrease from sqrtPriceX96 reported by slot0
  function getSqrtPrice(uint256 p0, uint256 p1) internal view returns (uint160 sqrtPrice) {
    uint256 numerator = _mul(_mul(p0, UNIT_1), (1 << 96));
    uint256 denominator = _mul(p1, UNIT_0);
    uint256 Q = numerator / denominator;
    uint256 sqrtQ = sqrt(Q);
    sqrtPrice = toUint160(sqrtQ << 48);
  }

  function toUint160(uint256 x) internal pure returns (uint160 z) {
    require((z = uint160(x)) == x, "GUniLPOracle/uint160-overflow");
  }

  ///@notice floating point division at @param factor scale
  function divide(uint256 numerator, uint256 denominator, uint256 factor) internal pure returns (uint256 result) {
    uint256 q = (numerator / denominator) * 10 ** factor;
    uint256 r = ((numerator * 10 ** factor) / denominator) % 10 ** factor;

    return q + r;
  }

  function _mul(uint256 _x, uint256 _y) internal pure returns (uint256 z) {
    require(_y == 0 || (z = _x * _y) / _y == _x, "GUniLPOracle/mul-overflow");
  }

  // FROM https://github.com/abdk-consulting/abdk-libraries-solidity/blob/16d7e1dd8628dfa2f88d5dadab731df7ada70bdd/ABDKMath64x64.sol#L687
  function sqrt(uint256 _x) private pure returns (uint128) {
    if (_x == 0) return 0;
    else {
      uint256 xx = _x;
      uint256 r = 1;
      if (xx >= 0x100000000000000000000000000000000) {
        xx >>= 128;
        r <<= 64;
      }
      if (xx >= 0x10000000000000000) {
        xx >>= 64;
        r <<= 32;
      }
      if (xx >= 0x100000000) {
        xx >>= 32;
        r <<= 16;
      }
      if (xx >= 0x10000) {
        xx >>= 16;
        r <<= 8;
      }
      if (xx >= 0x100) {
        xx >>= 8;
        r <<= 4;
      }
      if (xx >= 0x10) {
        xx >>= 4;
        r <<= 2;
      }
      if (xx >= 0x8) {
        r <<= 1;
      }
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1; // Seven iterations should be enough
      uint256 r1 = _x / r;
      return uint128(r < r1 ? r : r1);
    }
  }
}
