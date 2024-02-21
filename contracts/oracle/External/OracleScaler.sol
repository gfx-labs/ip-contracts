// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

///@notice this contract assumes usdc to be worth 1
contract OracleScaler is IOracleRelay {
  IOracleRelay public referenceOracle;
  uint256 public scalingFactor;
  bool public scaleUp;

  constructor(IOracleRelay _referenceOracle, uint256 _scalingFactor, bool _scaleUp) {
    referenceOracle = _referenceOracle;
    scalingFactor = _scalingFactor;
    scaleUp = _scaleUp;
  }

  function currentValue() external view override returns (uint256) {
    if (scaleUp) {
      return referenceOracle.currentValue() * scalingFactor;
    } else {
      return referenceOracle.currentValue() / scalingFactor;
    }
  }
}
