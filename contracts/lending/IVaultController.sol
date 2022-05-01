// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// @title VaultController Events
/// @notice interface which contains any events which the VaultController contract emits
interface VaultControllerEvents {
  event InterestEvent(uint64 epoch, uint192 amount, uint256 curve_val);
  event NewProtocolFee(uint256 protocol_fee);
  event RegisteredErc20(address token_address, uint256 LTVe4, address oracle_address, uint256 liquidationIncentivee4);
  event UpdateRegisteredErc20(
    address token_address,
    uint256 LTVe4,
    address oracle_address,
    uint256 liquidationIncentivee4
  );
  event NewVault(address vault_address, uint256 vaultId, address vaultOwner);
  event RegisterOracleMaster(address oracleMasterAddress);
  event RegisterCurveMaster(address curveMasterAddress);
  event BorrowUSDi(uint256 vaultId, address vaultAddress, uint256 borrowAmount);
  event RepayUSDi(uint256 vaultId, address vaultAddress, uint256 repayAmount);
  event Liquidate(uint256 vaultId, address asset_address, uint256 usdi_to_repurchase, uint256 tokens_to_liquidate);
}

/// @title VaultController Interface
/// @notice extends VaultControllerEvents
interface IVaultController is VaultControllerEvents{
  // initializer
  function initialize() external;

  // view functions
  function lastInterestTime() external view returns (uint64);
  function interestFactor() external view returns (uint192);
  function protocolFee() external view returns (uint192);
  function vaultAddress(uint96 id) external view returns (address);
  function amountToSolvency(uint96 id) external view returns(uint256);
  function accountLiability(uint96 id) external view returns (uint192);
  function accountBorrowingPower(uint96 id) external view returns (uint192);
  function tokensToLiquidate(uint96 id, address token) external view returns (uint256);
  function checkAccount(uint96 id) external view returns (bool);
  function totalBaseLiability() external view returns (uint256);

  // interest calculations
  function calculateInterest() external returns (uint256);

  // vault management business
  function mintVault() external returns (address);
  function liquidateAccount(
    uint96 id,
    address asset_address,
    uint256 tokenAmount
  ) external returns (uint256);

  function borrowUsdi(uint96 id, uint192 amount) external;
  function repayUSDi(uint96 id, uint192 amount) external;
  function repayAllUSDi(uint96 id) external;


  // admin
  function pause() external;
  function unpause() external;
  function register_oracle_master(address master_oracle_address) external;
  function register_curve_master(address master_curve_address) external;
  function change_protocol_fee(uint192 new_protocol_fee) external;
  function register_erc20(
    address token_address,
    uint256 LTV,
    address oracle_address,
    uint256 liquidationIncentive
  ) external;
  function register_usdi(address usdi_address) external;
  function update_registered_erc20(
    address token_address,
    uint256 LTV,
    address oracle_address,
    uint256 liquidationIncentive
  ) external;

  
}
