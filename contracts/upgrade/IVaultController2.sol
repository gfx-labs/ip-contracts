// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../lending/IVaultController.sol";

interface IVaultController2 is IVaultController {
  function newThing() external view returns (uint256);

  function changeTheThing(uint256 _newThing) external;
}
