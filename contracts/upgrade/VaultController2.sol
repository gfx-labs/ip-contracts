// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../lending/VaultController.sol";
import "./IVaultController2.sol";

contract VaultController2 is VaultController, IVaultController2 {
  //CHANGED extend storage
  uint256 public newThing;

  //CHANGED new event
  event ThingChanged(uint256 newThing);

  //CHANGED new function
  function changeTheThing(uint256 _newThing) public override {
    newThing = _newThing;
    emit ThingChanged(_newThing);
  }
}
