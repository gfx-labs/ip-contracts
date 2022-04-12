// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../_external/IERC20.sol";


interface IUSDI is IERC20 {

  function deposit(uint256 usdc_amount) external;
  function withdraw(uint256 usdc_amount) external;

  function setVaultController(address vault_master_address) external;

  function mint(uint256 usdc_amount) external;
  function burn(uint256 usdc_amount) external;

  function vault_master_burn(address target, uint256 amount) external;
  function vault_master_mint(address target, uint256 amount) external;
  
  function vault_master_donate(uint256 amount) external;
  function reserveRatio() external view returns (uint256);

}
