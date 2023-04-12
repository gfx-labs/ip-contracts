// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

// a library for handling binary fixed point numbers (https://en.wikipedia.org/wiki/Q_(number_format))
library FixedPoint {
  // range: [0, 2**112 - 1]
  // resolution: 1 / 2**112
  struct uq112x112 {
    uint224 _x;
  }

  // range: [0, 2**144 - 1]
  // resolution: 1 / 2**112
  struct uq144x112 {
    uint256 _x;
  }

  uint8 public constant RESOLUTION = 112;
  uint256 public constant Q112 = 0x10000000000000000000000000000; // 2**112
  uint256 private constant Q224 = 0x100000000000000000000000000000000000000000000000000000000; // 2**224
  uint256 private constant LOWER_MASK = 0xffffffffffffffffffffffffffff; // decimal of UQ*x112 (lower 112 bits)

  // returns a UQ112x112 which represents the ratio of the numerator to the denominator
  // can be lossy
  function fraction(uint256 numerator, uint256 denominator) internal pure returns (uq112x112 memory) {
    require(denominator > 0, "FixedPoint::fraction: division by zero");
    if (numerator == 0) return FixedPoint.uq112x112(0);

    if (numerator <= uint144(2 ** 144 - 1)) {
      uint256 result = (numerator << RESOLUTION) / denominator;
      require(result <= uint224(2 ** 224 - 1), "FixedPoint::fraction: overflow");
      return uq112x112(uint224(result));
    } else {
      uint256 result = mulDiv(numerator, Q112, denominator);
      require(result <= uint224(2 ** 224 - 1), "FixedPoint::fraction: overflow");
      return uq112x112(uint224(result));
    }
  }

  // decode a UQ144x112 into a uint144 by truncating after the radix point
  function decode144(uq144x112 memory self) internal pure returns (uint144) {
    return uint144(self._x >> RESOLUTION);
  }

  function mulDiv(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
    (uint256 l, uint256 h) = fullMul(x, y);

    uint256 mm = mulmod(x, y, d);
    if (mm > l) h -= 1;
    l -= mm;

    if (h == 0) return l / d;

    require(h < d, "FullMath: FULLDIV_OVERFLOW");
    return fullDiv(l, h, d);
  }

  function fullDiv(uint256 l, uint256 h, uint256 d) private pure returns (uint256) {
    uint256 pow2 = d & uint256((int256(d) * -1));
    d /= pow2;
    l /= pow2;
    l += h * ((uint256(int256(pow2) * -1)) / pow2 + 1);
    uint256 r = 1;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    return l * r;
  }

  function fullMul(uint256 x, uint256 y) internal pure returns (uint256 l, uint256 h) {
    uint256 mm = mulmod(x, y, uint256(2 ** 256 - 1));
    l = x * y;
    h = mm - l;
    if (mm < l) h -= 1;
  }
}
