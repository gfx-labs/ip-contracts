// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IUSDI {

  function deposit(uint256 amount) external;
  function withdraw(uint256 amount) external;

  function setVaultMaster(address vault_master_address) external;

  function mint(uint256 amount) external;
  function burn(uint256 amount) external;
  function vault_master_burn(address target, uint256 amount) external;
  function vault_master_mint(address target, uint256 amount) external;
  function vault_master_donate(uint256 amount) external;
  function reserveRatio() external view returns (uint256);

}
