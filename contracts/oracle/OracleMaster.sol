// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./IOracleMaster.sol";
import "./IOracleRelay.sol";

import "../_external/Ownable.sol";

/// @title An addressbook for oracle relays
/// @notice the oraclemaster is simply an addressbook of address->relay
/// this is so that contracts may use the OracleMaster to call any registered relays.
/// relays are individually pausable by owner, which disables the relay until reenabled
contract OracleMaster is IOracleMaster, Ownable {
  // mapping of token to address
  mapping(address => address) public _relays;
  mapping(address => bool) public _paused;

  /// @notice empty constructor
  constructor() Ownable() {}

  /// @notice gets the current price of the oracle registered for a token
  /// @param token_address address of the token to get value for
  /// @return the value of the token
  function getLivePrice(address token_address) external view override returns (uint256) {
    require(_paused[token_address] == false, "relay paused");
    require(_relays[token_address] != address(0x0), "token not enabled");
    IOracleRelay relay = IOracleRelay(_relays[token_address]);
    uint256 value = relay.currentValue();
    return value;
  }

  /// @notice admin only, sets relay for a token address to the relay addres
  /// @param token_address address of the token
  /// @param relay_address address of the relay
  function setRelay(address token_address, address relay_address) public override onlyOwner {
    _relays[token_address] = relay_address;
  }

  /// @notice admin only, pauses relay for a token address
  /// @param token_address address of the token
  /// @param state boolean true to pause, false to unpause
  function pauseRelay(address token_address, bool state) public override onlyOwner {
    _paused[token_address] = state;
  }
}
