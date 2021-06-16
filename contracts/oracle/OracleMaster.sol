// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "../_external/Ownable.sol";
import "./IOracleMaster.sol";
import "./IOracleRelay.sol";


contract OracleMaster is IOracleMaster, Ownable{

  mapping(address=>address) public _relays;
  uint256 public oraclecount;

  constructor() Ownable(){
    oraclecount = 0;
  }

  function set_relay(address token_address, address relay_address) public onlyOwner{
    _relays[token_address] = relay_address;
  }

  function get_live_price(address token_address) override external view returns (uint256) {
    if(_relays[token_address] != address(0x0)){
      IOracleRelay relay = IOracleRelay(_relays[token_address]);
      return relay.currentValue();
    }else{
      return 0;
    }
  }

}
