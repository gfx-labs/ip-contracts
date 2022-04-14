// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;



interface IVaultController {

  // view functions
  function InterestFactor() external view returns (uint256);
  function ProtocolFee() external view returns (uint256);
  function VaultAddress(uint256 id) external view returns (address);
  function AccountLiability(uint256 id) external view returns(uint256);
  function AccountBorrowingPower(uint256 id) external view returns (uint256);
  function TokensToLiquidate(uint256 id, address token, uint256 num) external view returns (uint256);


  // methods

  function mint_vault() external returns (address);
  function check_account(uint256 id) external view returns (bool);
  function liquidate_account(uint256 id, address asset_address, uint256 tokenAmount) external returns (uint256);
  function borrow_usdi(uint256 id, uint256 amount) external;
  function repay_usdi(uint256 id, uint256 amount) external;
  function repay_all_usdi(uint256 id) external;
  function calculate_interest() external;


  // admin
  function register_oracle_master(address master_oracle_address) external;
  function register_curve_master(address master_curve_address) external;
  function register_erc20(address token_address, uint256 LTV, address oracle_address, uint256 liquidationIncentive) external;
  function register_usdi(address usdi_address) external;
  function update_registered_erc20(address token_address, uint256 LTV, address oracle_address, uint256 liquidationIncentive) external;

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
