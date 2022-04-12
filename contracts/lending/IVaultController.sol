// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;



interface IVaultController {

  function getInterestFactor() external view returns (uint256);
  function getProtocolFee() external view returns (uint256);

  function check_account(uint256 id) external view returns (bool);
  function liquidate_account(uint256 id, address asset_address, uint256 tokenAmount) external returns (uint256);
    

  function get_account_liability(uint256 id) external view returns(uint256);

  function borrow_usdi(uint256 id, uint256 amount) external;
  function repay_usdi(uint256 id, uint256 amount) external;
  function repay_all_usdi(uint256 id) external;

  function calculate_interest() external;

  // admin
  function register_oracle_master(address master_oracle_address) external;
  function register_curve_master(address master_curve_address) external;

  // events
  event Interest(uint256 epoch, uint256 amount);
  event NewProtocolFee(uint256 protocol_fee);
  event RegisteredErc20(address token_address, uint256 LTVe4, address oracle_address, uint256 liquidationIncentivee4);
  event UpdateRegisteredErc20(address token_address, uint256 LTVe4, address oracle_address, uint256 liquidationIncentivee4);
  event NewVault(address vault_address, uint256 vaultId,address vaultOwner);
  event RegisterOracleMaster(address oracleMasterAddress);
  event RegisterCurveMaster(address curveMasterAddress);
  event BorrowUSDi(uint256 vaultId, address vaultAddress , uint256 borrowAmount);
  event RepayUSDi(uint256 vaultId, address vaultAddress, uint256 repayAmount);
  event Liquidate(uint256 vaultId, address asset_address, uint256 usdi_to_repurchase, uint256 tokens_to_liquidate);

}
