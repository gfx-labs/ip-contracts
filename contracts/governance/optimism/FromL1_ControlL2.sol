//SPDX-License-Identifier: Unlicense
// This contracts runs on L1, and controls a Greeter on L2.
// The addresses are specific to Optimistic Goerli.
pragma solidity 0.8.9;

import "./ILayer1Messenger.sol";
import "hardhat/console.sol";

contract FromL1_ControlL2Greeter {
  // Taken from https://community.optimism.io/docs/useful-tools/networks/#optimism-goerli

  ILayer1Messenger public immutable crossDomainMessengerAddr;

  address public immutable L2Messenger;

  constructor(address _l1CrossDomainMessenger, address _l2Messenger) {
    crossDomainMessengerAddr = ILayer1Messenger(_l1CrossDomainMessenger);
    L2Messenger = _l2Messenger;
  }

  function sendMessage() public {
    bytes memory message;

    message = abi.encodeWithSignature(
      "setRelay(address,address)",
      "0xd8284305b520FF5486ab718DBdfe46f18454aeDE",
      "0x45b265c7919D7FD8a0D673D7ACaA8F5A7abb430D"
    );

    console.log("Sending message");
    ILayer1Messenger(crossDomainMessengerAddr).sendMessage(
      L2Messenger,
      message,
      1000000 // within the free gas limit amount
    );
    console.log("Message sent");
  }
}
