// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IOracleMaster.sol";
import "./IOracleRelay.sol";

import "../_external/Ownable.sol";

contract OracleMaster is IOracleMaster, Ownable {
  // mapping of token to address
  mapping(address => address) public _relays;
  mapping(address => bool) public _paused;

  constructor() Ownable() {}

  function getLivePrice(address token_address) external view override returns (uint256) {
    require(_paused[token_address] == false, "relay paused");
    require(_relays[token_address] != address(0x0), "token not enabled");
    IOracleRelay relay = IOracleRelay(_relays[token_address]);
    uint256 value = relay.currentValue();
    require(value != 0, "value is 0");
    return value;
  }

  function set_relay(address token_address, address relay_address) public override onlyOwner {
    _relays[token_address] = relay_address;
  }

  function pause_relay(address token_address, bool state) public override onlyOwner {
    _paused[token_address] = state;
  }
}
