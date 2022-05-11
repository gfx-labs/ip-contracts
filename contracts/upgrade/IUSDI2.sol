// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IUSDI.sol";

interface IUSDI2 is IUSDI {
    function newThing() external view returns (uint256);

    function changeTheThing(uint256 _newThing) external;


}