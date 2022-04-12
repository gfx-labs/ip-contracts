// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOracleMaster {
    // all variables and inputs, and outputs, should be 18 decimals, like all other parts of USDI
    function get_live_price(address token_address)
        external
        view
        returns (uint256);
}
