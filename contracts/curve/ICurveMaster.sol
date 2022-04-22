// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title CurveMaster Interface
/// @notice Interface for interacting with CurveMaster
interface ICurveMaster {
  
  function _VaultControllerAddress() external view returns(address);
  
  function getValueAt(address curve_address, int256 x_value) external view returns (int256);

  function setVaultController(address vault_master_address) external;

  function set_curve(address token_address, address curve_address) external;
}
