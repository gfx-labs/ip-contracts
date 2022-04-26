// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title OracleMaster Interface
/// @notice Interface for interacting with OracleMaster
interface IOracleMaster {
  function getLivePrice(address token_address) external view returns (uint256);

  // admin functions
  function set_relay(address token_address, address relay_address) external;

  function pause_relay(address token_address, bool state) external;
}
