// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICurveMaster {
    // all variables and inputs, and outputs, should be 18 decimals, like all other parts of USDI
    function getValueAt(address curve_address, int256 x_value) external view returns (int256);
}
