// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/// @title CurveMaster Interface
/// @notice Interface for interacting with CurveMaster
interface ICurveMaster {
  function vaultControllerAddress() external view returns (address);

  function getValueAt(address token_address, int256 x_value) external view returns (int256);

  function _curves(address curve_address) external view returns (address);

  function setVaultController(address vault_master_address) external;

  function setCurve(address token_address, address curve_address) external;

  function forceSetCurve(address token_address, address curve_address) external;
}
