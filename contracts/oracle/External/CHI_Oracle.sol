// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";

import "hardhat/console.sol";

interface IPot {
  function chi() external view returns (uint256);

  function rho() external view returns (uint256);

  function Pie() external view returns (uint256);
}

contract CHI_Oracle is IOracleRelay {
  IPot public immutable pot; //IPot(0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7);

  constructor(IPot _pot) {
    pot = _pot;
  }

  function currentValue() external view override returns (uint256 wad) {
    //truncate to 1e18 down from 1e27
    wad = pot.chi() / 1e9;
  }
}
