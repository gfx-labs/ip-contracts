// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOracleRelay {
  function currentValue() external view returns (uint256);
}
