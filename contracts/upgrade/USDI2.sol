// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../USDI.sol";
import "./IUSDI2.sol";

contract USDI2 is USDI {
  //CHANGED extend storage
  uint256 public newThing;

  //CHANGED new event
  event ThingChanged(uint256 newThing);

  //CHANGED new function
  function changeTheThing(uint256 _newThing) public {
    newThing = _newThing;
    emit ThingChanged(_newThing);
  }







}
