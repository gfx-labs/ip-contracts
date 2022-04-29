// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IUSDI.sol";

import "./Vault.sol";
import "./IVault.sol";

import "./IVaultController.sol";

import "../oracle/OracleMaster.sol";
import "../curve/CurveMaster.sol";

import "../_external/IERC20.sol";
import "../_external/compound/ExponentialNoError.sol";
import "../_external/openzeppelin/OwnableUpgradeable.sol";
import "../_external/openzeppelin/Initializable.sol";
import "../_external/openzeppelin/PausableUpgradeable.sol";

/// @title Controller of all vaults in the USDI borrow/lend system
/// @notice VaultController contains all business logic for borrowing and lending through the protocol.
/// It is also in charge of accruing interest.
contract VaultController is
  Initializable,
  PausableUpgradeable,
  IVaultController,
  ExponentialNoError,
  OwnableUpgradeable
{
  // mapping of vault id to vault address
  mapping(uint96 => address) public _vaultId_vaultAddress;

  // mapping of token address to token id
  mapping(address => uint256) public _tokenAddress_tokenId;

  //mapping of tokenId to the LTV*1
  mapping(uint256 => uint256) public _tokenId_tokenLTV;

  //mapping of tokenId to its corresponding oracleAddress (which are addresses)
  mapping(uint256 => address) public _tokenId_oracleAddress;

  //mapping of token address to its corresponding liquidation incentive
  mapping(address => uint256) public _tokenAddress_liquidationIncentive;
  address[] public _enabledTokens;

  OracleMaster public _oracleMaster;
  CurveMaster public _curveMaster;

  IUSDI public _usdi;
  uint96 public _vaultsMinted;

  uint256 public _tokensRegistered;
  uint192 public _totalBaseLiability;

  uint192 public _protocolFee;

  struct Interest {
    uint64 lastTime;
    uint192 factor;
  }
  Interest public _interest;

  /// @notice any function with this modifier will call the pay_interest() function before
  modifier paysInterest() {
    pay_interest();
    _;
  }

  /// @notice no initialization arguments.
  function initialize() external override initializer {
    __Ownable_init();
    __Pausable_init();
    _vaultsMinted = 0;
    _tokensRegistered = 0;
    _interest = Interest(uint64(block.timestamp), 1e18);
    _totalBaseLiability = 0;
    _protocolFee = 1e14;
  }

  /// @notice get current interest factor
  /// @return interest factor
  function InterestFactor() external view override returns (uint192) {
    return _interest.factor;
  }

  /// @notice get last interest time
  /// @return interest time
  function LastInterestTime() external view override returns (uint64) {
    return _interest.lastTime;
  }

  /// @notice get current protocol fee
  /// @return protocol fee
  function ProtocolFee() external view override returns (uint192) {
    return _protocolFee;
  }

  /// @notice get vault address of id
  /// @return the address of vault
  function VaultAddress(uint96 id) external view override returns (address) {
    return _vaultId_vaultAddress[id];
  }

  /// @notice create a new vault
  /// @return address of the new vault
  function mintVault() public override returns (address) {
    _vaultsMinted = _vaultsMinted + 1;
    address vault_address = address(new Vault(_vaultsMinted, _msgSender(), address(this)));
    _vaultId_vaultAddress[_vaultsMinted] = vault_address;

    emit NewVault(vault_address, _vaultsMinted, _msgSender());
    return vault_address;
  }

  /// @notice pause the contract
  function pause() external override onlyOwner {
    _pause();
  }

  /// @notice unpause the contract
  function unpause() external override onlyOwner {
    _unpause();
  }

  /// @notice register the USDi contract
  /// @param usdi_address address to register as USDi
  function register_usdi(address usdi_address) external override onlyOwner {
    _usdi = IUSDI(usdi_address);
  }

  /// @notice register the OracleMaster contract
  /// @param master_oracle_address address to register as OracleMaster
  function register_oracle_master(address master_oracle_address) external override onlyOwner {
    _oracleMaster = OracleMaster(master_oracle_address);

    emit RegisterOracleMaster(master_oracle_address);
  }

  /// @notice register the CurveMaster address
  /// @param master_curve_address address to register as CurveMaster
  function register_curve_master(address master_curve_address) external override onlyOwner {
    _curveMaster = CurveMaster(master_curve_address);
    emit RegisterCurveMaster(master_curve_address);
  }

  /// @notice register the CurveMaster address
  /// @param new_protocol_fee protocol fee in terms of 1e18=100%
  function change_protocol_fee(uint192 new_protocol_fee) external override onlyOwner {
    require(new_protocol_fee < 1e18, "fee is too large");
    _protocolFee = new_protocol_fee;
    emit NewProtocolFee(_protocolFee);
  }

  /// @notice register a new token to be used as collateral
  /// @param token_address token to register
  /// @param oracle_address oracle to attach to the token
  /// @param liquidationIncentive liquidation penalty for the token
  function register_erc20(
    address token_address,
    uint256 LTV,
    address oracle_address,
    uint256 liquidationIncentive
  ) external override onlyOwner {
    require(_oracleMaster._relays(oracle_address) != address(0x0), "oracle does not exist");
    require(_tokenAddress_tokenId[token_address] == 0, "token already registered");
    _tokensRegistered = _tokensRegistered + 1;
    _tokenAddress_tokenId[token_address] = _tokensRegistered;
    _tokenId_oracleAddress[_tokensRegistered] = oracle_address;
    _enabledTokens.push(token_address);
    _tokenId_tokenLTV[_tokensRegistered] = LTV;
    _tokenAddress_liquidationIncentive[token_address] = liquidationIncentive;

    emit RegisteredErc20(token_address, LTV, oracle_address, liquidationIncentive);
  }

  /// @notice update an existing collateral with new collateral parameters
  /// @param token_address the token to modify
  /// @param LTV new loan-to-value of the token
  /// @param oracle_address new oracle to attach to the token
  /// @param liquidationIncentive new liquidation penalty for the token
  function update_registered_erc20(
    address token_address,
    uint256 LTV,
    address oracle_address,
    uint256 liquidationIncentive
  ) external override onlyOwner {
    require(_oracleMaster._relays(oracle_address) != address(0x0), "oracle does not exist");
    require(_tokenAddress_tokenId[token_address] != 0, "token is not registered");
    _tokenId_oracleAddress[_tokensRegistered] = oracle_address;
    _tokenId_tokenLTV[_tokensRegistered] = LTV;
    _tokenAddress_liquidationIncentive[token_address] = liquidationIncentive;

    emit UpdateRegisteredErc20(token_address, LTV, oracle_address, liquidationIncentive);
  }

  /// @notice check an account for over-collateralization. returns false if amount borrowed is greater than borrowing power.
  /// @param id the vault to check
  /// @return true = vault over-collateralized; false = vault under-collaterlized
  function checkAccount(uint96 id) public view override returns (bool) {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    IVault vault = IVault(vault_address);
    uint256 total_liquidity_value = get_vault_borrowing_power(vault);
    uint256 usdi_liability = truncate((vault.BaseLiability() * _interest.factor));
    return (total_liquidity_value >= usdi_liability);
  }

  /// @notice borrow usdi from a vault. only vault minter may borrow from their vault
  /// @param id vault to borrow from
  /// @param amount amount of usdi to borrow
  /// @dev pays interest
  function borrowUsdi(uint96 id, uint192 amount) external override paysInterest whenNotPaused {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x00), "vault does not exist");
    IVault vault = IVault(vault_address);

    require(_msgSender() == vault.Minter(), "sender not minter");

    uint192 base_amount = safeu192(uint256(amount * expScale) / uint256(_interest.factor));
    uint256 base_liability = vault.modify_liability(true, base_amount);
    _totalBaseLiability = _totalBaseLiability + safeu192(base_amount);
    uint256 usdi_liability = truncate(uint256(_interest.factor - 1) * base_liability);

    uint256 total_liquidity_value = get_vault_borrowing_power(vault);

    require(total_liquidity_value >= usdi_liability, "account insolvent");

    uint256 al = _AccountLiability(id);

    _usdi.vault_master_mint(_msgSender(), al);

    emit BorrowUSDi(id, vault_address, al);
  }

  /// @notice repay a vault's usdi loan. anyone may repay
  /// @param id vault to repay
  /// @param amount amount of usdi to repay
  /// @dev pays interest
  function repayUSDi(uint96 id, uint192 amount) external override paysInterest whenNotPaused {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    IVault vault = IVault(vault_address);
    uint192 base_amount = (amount * 1e18) / _interest.factor;
    _totalBaseLiability = _totalBaseLiability - base_amount;
    require(base_amount <= vault.BaseLiability(), "repay > borrow amount"); //repay all here if true?
    vault.modify_liability(false, base_amount);
    _usdi.vault_master_burn(_msgSender(), amount);
    emit RepayUSDi(id, vault_address, amount);
  }

  /// @notice repay all of a vaults usdi. anyone may repay a vaults liabilities
  /// @param id the vault to repay
  /// @dev pays interest
  function repayAllUSDi(uint96 id) external override paysInterest whenNotPaused {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    IVault vault = IVault(vault_address);

    Exp memory interest_factor = Exp({mantissa: _interest.factor});
    //uint256 usdi_liability = truncate(ExponentialNoError.mul_ScalarTruncate(interest_factor, vault.BaseLiability()));//BUG - not mul_ScalarTruncate
    uint256 usdi_liability = truncate(ExponentialNoError.mul_(interest_factor, vault.BaseLiability()));

    vault.modify_liability(false, vault.BaseLiability());
    _usdi.vault_master_burn(_msgSender(), usdi_liability);

    emit RepayUSDi(id, vault_address, usdi_liability);
  }

  /// @notice liquidate an underwater vault
  /// vaults may be liquidated up to the point where they are exactly solvent
  /// @param id the vault liquidate
  /// @param asset_address the token the liquidator wishes to liquidate
  /// @param tokens_to_liquidate - number of tokens to liquidate
  /// @dev pays interest
  function liquidate_account(
    uint96 id,
    address asset_address,
    uint256 tokens_to_liquidate
  ) external override paysInterest whenNotPaused returns (uint256) {
    require(tokens_to_liquidate != 0, "must liquidate >0");
    require(!checkAccount(id), "Vault is solvent");
    (uint256 tokenAmount, uint256 badFillPrice) = _liquidationMath(id, asset_address, tokens_to_liquidate);

    if (tokenAmount != 0) {
      tokens_to_liquidate = tokenAmount;
    }

    //bug? - this amount is not sufficient, should be able to liquidate until you run out of USDi - not truncate?
    //uint256 usdi_to_repurchase = truncate(badFillPrice * tokens_to_liquidate);
    uint256 usdi_to_repurchase = truncate(badFillPrice * tokens_to_liquidate);
    IVault vault = getVault(id);

    //decrease vault's liability -- switch to truncate?
    vault.modify_liability(false, div_(usdi_to_repurchase * 1e18, _interest.factor));

    //decrease liquidator's USDi balance
    _usdi.vault_master_burn(_msgSender(), usdi_to_repurchase);

    // finally, deliver tokens to liquidator
    vault.masterTransfer(asset_address, _msgSender(), tokens_to_liquidate);

    require(get_vault_borrowing_power(vault) <= _AccountLiability(id), "overliquidation");
    // I don't think we need this. Will always be true because it is already implied by _liquidationMath.
    emit Liquidate(id, asset_address, usdi_to_repurchase, tokens_to_liquidate);
    return tokens_to_liquidate;
  }

  /// @dev calculate amount of tokens to liquidate for a vault
  /// @param id the vault to get info for
  /// @param asset_address the token to calculate how many tokens to liquidate
  /// @return - amount of tokens liquidatable
  /// @notice the amount of tokens owed is a moving target and changes with each block as pay_interest is called
  function TokensToLiquidate(uint96 id, address asset_address) external view override returns (uint256) {
    uint256 MAX_UINT = 2**256 - 1;
    (
      uint256 tokenAmount, /*uint256 badFillPrice*/

    ) = _liquidationMath(id, asset_address, MAX_UINT);

    return tokenAmount;
  }

  /// @notice internal function with business logic for liquidation math
  /// @param id the vault to get info for
  /// @param asset_address the token to calculate how many tokens to liquidate
  /// @param tokens_to_liquidate the max amount of tokens one wishes to liquidate
  /// @return the amount of tokens underwater this vault is
  /// @return the bad fill price for the token
  function _liquidationMath(
    uint96 id,
    address asset_address,
    uint256 tokens_to_liquidate
  ) internal view returns (uint256, uint256) {
    IVault vault = getVault(id);

    //get price of asset scaled to decimal 18
    uint256 price = _oracleMaster.getLivePrice(asset_address);

    // get price discounted by liquidation penalty
    uint256 badFillPrice = truncate(price * (1e18 - _tokenAddress_liquidationIncentive[asset_address]));

    uint256 denominator = truncate(
      price *
        ((1e18 - _tokenAddress_liquidationIncentive[asset_address]) -
          _tokenId_tokenLTV[_tokenAddress_tokenId[asset_address]])
    );

    uint256 max_tokens_to_liquidate = (_AmountToSolvency(id) * 1e18) / denominator;

    //Cannot liquidate more than is necessary to make account over-collateralized
    if (tokens_to_liquidate > max_tokens_to_liquidate) {
      tokens_to_liquidate = max_tokens_to_liquidate;
    }

    //Cannot liquidate more collateral than there is in the vault
    if (tokens_to_liquidate > vault.tokenBalance(asset_address)) {
      tokens_to_liquidate = vault.tokenBalance(asset_address);
    }

    return (tokens_to_liquidate, badFillPrice);
  }

  /// @notice internal function to wrap getting of vaults
  /// @param id id of vault
  /// @return vault IVault contract of
  function getVault(uint96 id) internal view returns (IVault vault) {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    vault = IVault(vault_address);
  }

  ///@notice amount of USDI needed to reach even solvency
  /// @param id id of vault
  function AmountToSolvency(uint96 id) public view override returns (uint256) {
    require(!checkAccount(id), "Vault is solvent");
    return _AmountToSolvency(id);
  }

  function _AmountToSolvency(uint96 id) internal view returns (uint256) {
    return _AccountLiability(id) - get_vault_borrowing_power(getVault(id));
  }

  /// @notice get account liability of vault
  /// @param id id of vault
  /// @return amount of USDI the vault owes
  /// @dev implementation _AccountLiability
  function AccountLiability(uint96 id) external view override returns (uint192) {
    return _AccountLiability(id);
  }

  function _AccountLiability(uint96 id) internal view returns (uint192) {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    IVault vault = IVault(vault_address);
    return safeu192(truncate(vault.BaseLiability() * _interest.factor));
  }

  /// @notice get account borrowing power for vault
  /// @param id id of vault
  /// @return amount of USDI the vault owes
  /// @dev implementation in get_vault_borrowing_power
  function AccountBorrowingPower(uint96 id) external view override returns (uint192) {
    return get_vault_borrowing_power(IVault(_vaultId_vaultAddress[id]));
  }

  function get_vault_borrowing_power(IVault vault) private view returns (uint192) {
    uint192 total_liquidity_value = 0;
    for (uint192 i = 1; i <= _tokensRegistered; i++) {
      address token_address = _enabledTokens[i - 1];
      uint192 raw_price = safeu192(_oracleMaster.getLivePrice(token_address));
      if (raw_price == 0) {
        continue;
      }
      uint256 balance = vault.tokenBalance(token_address);
      if (balance == 0) {
        continue;
      }
      uint192 token_value = safeu192(truncate(truncate(raw_price * balance * _tokenId_tokenLTV[i])));
      total_liquidity_value = total_liquidity_value + token_value;
    }
    return total_liquidity_value;
  }

  /// @notice calls the pay interest function
  /// @dev implementation in pay_interest
  function calculateInterest() external override returns (uint256) {
    return pay_interest();
  }

  /// @notice accrue interest to borrowers and distribute it to USDi holders.
  /// this function is called before any function that changes the reserve ratio
  function pay_interest() private returns (uint256) {
    uint64 timeDifference = uint64(block.timestamp) - _interest.lastTime;
    if (timeDifference == 0) {
      return 0;
    }
    uint256 ui18 = uint256(_usdi.reserveRatio());
    int256 reserve_ratio = int256(ui18);
    int256 int_curve_val = _curveMaster.getValueAt(address(0x00), reserve_ratio);
    require(int_curve_val >= 0, "rate too small");

    uint192 curve_val = safeu192(uint256(int_curve_val));

    // calculate the amount of total outstanding loans before and after this interest accrual
    uint192 e18_factor_increase = safeu192(
      truncate(
        truncate((uint256(timeDifference) * uint256(1e18) * uint256(curve_val)) / (365 days + 6 hours)) *
          uint256(_interest.factor)
      )
    );

    uint192 valueBefore = safeu192(truncate(uint256(_totalBaseLiability) * uint256(_interest.factor)));
    _interest = Interest(uint64(block.timestamp), _interest.factor + e18_factor_increase);
    uint192 valueAfter = safeu192(truncate(uint256(_totalBaseLiability) * uint256(_interest.factor)));

    // take protocol fee and distribute the rest to all USDi holders
    uint192 protocolAmount = safeu192(truncate(uint256(valueAfter - valueBefore) * uint256(_protocolFee)));
    _usdi.vault_master_donate(valueAfter - valueBefore - protocolAmount);
    _usdi.vault_master_mint(owner(), protocolAmount);
    emit InterestEvent(uint64(block.timestamp), e18_factor_increase, curve_val);
    return e18_factor_increase;
  }
}
