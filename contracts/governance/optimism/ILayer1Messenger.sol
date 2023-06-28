// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

//https://etherscan.io/address/0x25ace71c97b33cc4729cf772ae268934f7ab5fa1#writeProxyContract
interface ILayer1Messenger {
  function relayMessage(
    uint256 _nonce,
    address _sender,
    address _target,
    uint256 _value,
    uint256 _minGasLimit,
    bytes memory _message
  ) external payable;

  function sendMessage(address _target, bytes memory _message, uint256 _minGasLimit) external payable;

  function messageNonce() external view returns (uint256);

  function baseGas(bytes calldata _message, uint32 _minGasLimit) external view returns (uint64);

  function OTHER_MESSENGER() external view returns (address);

  
}
