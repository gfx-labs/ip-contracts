// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/uniswap/IUniswapV3PoolDerivedState.sol";
import "../../_external/uniswap/TickMath.sol";

import "hardhat/console.sol";

/// based off of the MKR implementation https://github.com/makerdao/univ3-lp-oracle/blob/master/src/GUniLPOracle.sol
contract UniV3LPoracle is IOracleRelay {
  IUniswapV3PoolDerivedState public immutable _pool;
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
    _pool = IUniswapV3PoolDerivedState(pool_address);
    token0Oracle = _token0Oracle;
    token1Oracle = _token1Oracle;

    UNIT_0 = 10 ** token0Units;
    UNIT_1 = 10 ** token1Units;
  }

  function currentValue() external view override returns (uint256) {
    console.log("CurrentValue: ");

    /**
    //todo refactor unit conversion
    console.log("1e18: ", 1e18);
    console.log("1e8 : ", 1e8);
    console.log("unt0: ", UNIT_0);
   */

    uint256 p0 = token0Oracle.currentValue() / 1e10;
    uint256 p1 = token1Oracle.currentValue();
    uint256 sqrtPriceX96 = getSqrtPrice(p0, p1);
    console.log("RESULT: ", sqrtPriceX96);
  }

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
