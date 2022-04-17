// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ICurveSlave.sol";

// this is the piecewise linear function which returns values for input values 0 to 100
// the variables _r0, _r1, and _r2, along with _s1 and _s2 describe the piecewise function
//
// the function generates appears as below
//
//  (0, _r0)
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
contract ThreeLines0_100 is ICurveSlave {
    int256 public _r0;
    int256 public _r1;
    int256 public _r2;
    int256 public _s1;
    int256 public _s2;

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
            return linearInterpolation(rise, run, x_value - _s0, _r1);
        }
        if (x_value <= max) {
            return _r2;
        }
        revert();
    }

    function linearInterpolation(
        int256 rise,
        int256 run,
        int256 distance,
        int256 b
    ) public pure returns (int256) {
        int256 mE6 = (rise * 1e6) / run;
        int256 result = (mE6 * distance) / 1e6 + b;
        return result;
    }
}
