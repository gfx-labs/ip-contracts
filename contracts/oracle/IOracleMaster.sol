// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOracleMaster {
  // all variables and inputs, and outputs, should be 18 decimals, like all other parts of USDI
  function getLivePrice(address token_address) external view returns (uint256);

  // admin functions
  function set_relay(address token_address, address relay_address) external;

  function pause_relay(address token_address, bool state) external;
}
