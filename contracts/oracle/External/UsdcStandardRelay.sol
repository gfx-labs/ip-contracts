// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

///@notice this contract assumes usdc to be worth 1
contract UsdcStandardRelay is IOracleRelay {

  ///@notice return 1e36 for scaling purposes
  function currentValue() external pure override returns (uint256) {
    return 1e30;
  }
}
