// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;



interface IVaultMaster {

  function getInterestFactor() external view returns (uint256);

  function check_account(uint256 id) external view returns (bool);

  function liquidate_account(uint256 id,address asset_address, uint256 maximum) external returns (uint256);

  function get_account_liability(uint256 id) external view returns(uint256);
  function borrow_usdi(uint256 id, uint256 amount) external;
  function repay_usdi(uint256 id, uint256 amount) external;
  function repay_all_usdi(uint256 id) external;

  function calculate_interest() external;

}
