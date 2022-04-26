// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ICurveSlave.sol";

/// @title Piecewise linear curve f(x)
/// @notice returns values for input values 0 to 1e18,
/// described by variables _r0, _r1, and _r2, along with _s1 and _s2
/// graph of function appears below code
// solhint-disable-next-line contract-name-camelcase
contract ThreeLines0_100 is ICurveSlave {
  int256 public _r0;
  int256 public _r1;
  int256 public _r2;
  int256 public _s1;
  int256 public _s2;

  /// @notice curve is constructed on deploy and may not be modified
  /// @param r0 y value at x=0
  /// @param r1 y value at the x=s1
  /// @param r2 y value at x > s2 && x < 1e18
  /// @param s1 x value of first breakpoint
  /// @param s2 x value of second breakpoint
  constructor(
    int256 r0,
    int256 r1,
    int256 r2,
    int256 s1,
    int256 s2
  ) {
    _r0 = r0;
    _r1 = r1;
    _r2 = r2;
    _s1 = s1;
    _s2 = s2;
  }

  /// @notice calculates f(x)
  /// @param x_value x value to evaluate
  /// @return value of f(x)
  function valueAt(int256 x_value) external view override returns (int256) {
    int256 max = 1e18;
    require(x_value >= 0, "too small");
    require(x_value <= max, "too large");
    if (x_value < _s1) {
      int256 rise = _r1 - _r0;
      int256 run = _s1;
      return linearInterpolation(rise, run, x_value, _r0);
    }
    if (x_value < _s2) {
      int256 rise = _r2 - _r1;
      int256 run = _s2 - _s1;
      return linearInterpolation(rise, run, x_value - _s1, _r1);
    }
    if (x_value <= max) {
      return _r2;
    }
    revert("bad curve");
  }

  /// @notice linear interpolation, g(x) = mx+b
  /// @dev function should be pure. m = rise/run
  /// @param rise x delta, used to calculate "m"
  /// @param run y delta, used to calculate "m"
  /// @param distance distance to interpolate, "x"
  /// @param b y intercept, "b"
  /// @return value of g(x)
  function linearInterpolation(
    int256 rise,
    int256 run,
    int256 distance,
    int256 b
  ) private pure returns (int256) {
    int256 mE6 = (rise * 1e6) / run;
    int256 result = (mE6 * distance) / 1e6 + b;
    return result;
  }
}
/// (0, _r0)
///      |\
///      | -\
///      |   \
///      |    -\
///      |      -\
///      |        \
///      |         -\
///      |           \
///      |            -\
///      |              -\
///      |                \
///      |                 -\
///      |                   \
///      |                    -\
///      |                      -\
///      |                        \
///      |                         -\
///      |                          ***----\
///      |                     (_s1, _r1)   ----\
///      |                                       ----\
///      |                                            ----\
///      |                                                 ----\ (_s2, _r2)
///      |                                                             ***--------------------------------------------------------------\
///      |
///      |
///      |
///      |
///      +---------------------------------------------------------------------------------------------------------------------------------
/// (0,0)                                                                                                                            (100, _r2)
