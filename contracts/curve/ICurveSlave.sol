// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICurveSlave {
  // all variables and inputs, and outputs, should be 18 decimals, like all other parts of USDI
  function valueAt(int256 x_value) external view returns (int256);
}
