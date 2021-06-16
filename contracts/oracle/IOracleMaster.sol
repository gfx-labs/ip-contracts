// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
interface IOracleMaster {


  function get_live_price(address token_address) external view returns (uint256);


}
