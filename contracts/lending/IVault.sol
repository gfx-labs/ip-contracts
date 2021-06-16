// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IVault {

  function getBalances(address arg1) external view returns (uint256);

  function getBaseLiability() external view returns (uint256);

  function getMinter() external view returns (address);

  function deposit_erc20(address token_address, uint256 amount) external;

  function withdraw_erc20(address token_address, uint256 amount) external;

  function claim_erc20(address token_address, uint256 amount) external returns (uint256);

  function decrease_liability(uint256 base_amount) external returns (uint256);

  function increase_liability(uint256 base_amount) external returns (uint256);



}
