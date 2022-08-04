// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

import "../../_external/uniswap/IUniswapV2Pair.sol";
import "../../_external/uniswap/UniswapV2OracleLibrary.sol";

/// @title Oracle that wraps a univ3 pool
/// @notice The oracle returns (univ3) * mul / div
/// if quote_token_is_token0 == true, then the reciprocal is returned
contract UniswapV2OracleRelay is IOracleRelay {
  uint256 public immutable _mul;
  uint256 public immutable _div;
  uint256 public constant PERIOD = 10;

  IUniswapV2Pair public immutable pair;
  address public immutable token0;
  address public immutable token1;
  address public immutable targetToken;

  uint256 public price0CumulativeLast;
  uint256 public price1CumulativeLast;
  uint32 public blockTimestampLast;

  // NOTE: binary fixed point numbers
  // range: [0, 2**112 - 1]
  // resolution: 1 / 2**112
  uint224 public price0Average;
  uint224 public price1Average;

  /// @notice all values set at construction time

  constructor(
    IUniswapV2Pair _pair,
    address _targetToken,
    uint256 mul,
    uint256 div
  ) {
    _mul = mul;
    _div = div;

    targetToken = _targetToken;

    pair = _pair;
    token0 = _pair.token0();
    token1 = _pair.token1();
    price0CumulativeLast = _pair.price0CumulativeLast();
    price1CumulativeLast = _pair.price1CumulativeLast();
    (, , blockTimestampLast) = _pair.getReserves();
  }

  function update() external {
    (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) = UniswapV2OracleLibrary
      .currentCumulativePrices(address(pair));
    uint32 timeElapsed = blockTimestamp - blockTimestampLast;

    require(timeElapsed >= PERIOD, "time elapsed < min period");

    // NOTE: overflow is desired
    /*
        |----b-------------------------a---------|
        0                                     2**256 - 1
        b - a is preserved even if b overflows
        */
    // NOTE: uint -> uint224 cuts off the bits above uint224
    // max uint
    // 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
    // max uint244
    // 0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff
    price0Average = uint224((price0Cumulative - price0CumulativeLast) / timeElapsed);
    price1Average = uint224((price1Cumulative - price1CumulativeLast) / timeElapsed);

    price0CumulativeLast = price0Cumulative;
    price1CumulativeLast = price1Cumulative;
    blockTimestampLast = blockTimestamp;
  }

  /// @notice the current reported value of the oracle
  /// @return the current value
  /// @dev implementation in getLastSecond
  function currentValue() external view override returns (uint256) {
    return getLastSeconds();
  }

  function getLastSeconds() private view returns (uint256 price) {
    require(targetToken == token0 || targetToken == token1, "invalid token");
    if (targetToken == token0) {
      price = (price0Average * 1e18) >> 112;
    } else {
      price = (price1Average * 1e18) >> 112;
    }
  }
}
