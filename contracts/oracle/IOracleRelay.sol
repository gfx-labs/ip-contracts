// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOracleRelay {
    // returns  price with 18 decimals
    function currentValue() external view returns (uint256);
}
