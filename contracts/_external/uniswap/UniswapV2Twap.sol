// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "./IUniswapV2Pair.sol";
import "./FixedPoint.sol";
import "./UniswapV2OracleLibrary.sol";
//import "./UniswapV2Library.sol";

contract UniswapV2Twap {
  using FixedPoint for *;

  uint256 public constant PERIOD = 10;

  IUniswapV2Pair public immutable pair;
  address public immutable token0;
  address public immutable token1;

  uint256 public price0CumulativeLast;
  uint256 public price1CumulativeLast;
  uint32 public blockTimestampLast;

  // NOTE: binary fixed point numbers
  // range: [0, 2**112 - 1]
  // resolution: 1 / 2**112
  FixedPoint.uq112x112 public price0Average;
  FixedPoint.uq112x112 public price1Average;

  // NOTE: public visibility
  // NOTE: IUniswapV2Pair
  constructor(IUniswapV2Pair _pair) public {
    pair = _pair;
    token0 = _pair.token0();
    token1 = _pair.token1();
    price0CumulativeLast = _pair.price0CumulativeLast();
    price1CumulativeLast = _pair.price1CumulativeLast();
    (, , blockTimestampLast) = _pair.getReserves();
  }

  function update() external {
        (
            uint price0Cumulative,
            uint price1Cumulative,
            uint32 blockTimestamp
        ) = UniswapV2OracleLibrary.currentCumulativePrices(address(pair));
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
        price0Average = FixedPoint.uq112x112(
            uint224((price0Cumulative - price0CumulativeLast) / timeElapsed)
        );
        price1Average = FixedPoint.uq112x112(
            uint224((price1Cumulative - price1CumulativeLast) / timeElapsed)
        );

        price0CumulativeLast = price0Cumulative;
        price1CumulativeLast = price1Cumulative;
        blockTimestampLast = blockTimestamp;
    }

    function consult(address token, uint amountIn)
        external
        view
        returns (uint amountOut)
    {
        require(token == token0 || token == token1, "invalid token");

        if (token == token0) {
            amountOut = price0Average._x * (amountIn >> 112);
        } else {
            amountOut = price1Average._x * (amountIn >> 112);
        }
    }
}