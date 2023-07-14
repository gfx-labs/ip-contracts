// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";

interface Imessenger {
  function sendMessage(address _target, bytes calldata _message, uint32 _gasLimit) external;
}

contract CrossChainIntermediary {
  function test() external {
    console.log("Test");
  }
}
