// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./_external/IERC20Metadata.sol";

/// @title interface to interact with USDI contract
interface IUSDIFULL is IERC20Metadata {

  // additional function interfaces
  function owner() external returns (address);

  function monetaryPolicy() external returns (address);

  function initialize(address reserveAddress) external;
  // getters
  function reserveRatio() external view returns (uint256);
  // business
  function deposit(uint256 usdc_amount) external;

  function withdraw(uint256 usdc_amount) external;

  // admin & internal use functions
  function pause() external;
  function unpause() external;

  function mint(uint256 usdc_amount) external;

  function burn(uint256 usdc_amount) external;

  function setVaultController(address vault_master_address) external;
  function setMonetaryPolicy(address monetaryPolicy_) external;

  function vault_master_burn(address target, uint256 amount) external;

  function vault_master_mint(address target, uint256 amount) external;

  function vault_master_donate(uint256 amount) external;
}
