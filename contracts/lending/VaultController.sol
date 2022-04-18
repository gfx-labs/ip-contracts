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

import "hardhat/console.sol";

contract VaultController is
  Initializable,
  PausableUpgradeable,
  IVaultController,
  ExponentialNoError,
  OwnableUpgradeable
{
  // mapping of vault id to vault address
  mapping(uint256 => address) public _vaultId_vaultAddress;

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

  uint256 public _vaultsMinted;
  uint256 public _tokensRegistered;
  uint256 public _totalBaseLiability;
  uint256 public _lastInterestTime;
  uint256 public _interestFactor;
  uint256 public _protocolFee;

  modifier paysInterest() {
    pay_interest();
    _;
  }

  function initialize() external override initializer {
    __Ownable_init();
    __Pausable_init();
    _vaultsMinted = 0;
    _tokensRegistered = 0;
    _interestFactor = 1e18; // initialize at 1e18;
    _totalBaseLiability = 0;
    _protocolFee = 1e14;
    _lastInterestTime = block.timestamp;
  }

  function InterestFactor() external view override returns (uint256) {
    return _interestFactor;
  }

  function ProtocolFee() external view override returns (uint256) {
    return _protocolFee;
  }

  function VaultAddress(uint256 id) external view override returns (address) {
    return _vaultId_vaultAddress[id];
  }

  function mintVault() public override returns (address) {
    _vaultsMinted = _vaultsMinted + 1;
    address vault_address = address(new Vault(_vaultsMinted, _msgSender(), address(this), address(_usdi)));
    _vaultId_vaultAddress[_vaultsMinted] = vault_address;

    emit NewVault(vault_address, _vaultsMinted, _msgSender());
    return vault_address;
  }

  function pause() external override onlyOwner {
    _pause();
  }

  function unpause() external override onlyOwner {
    _unpause();
  }

  function register_usdi(address usdi_address) external override onlyOwner {
    _usdi = IUSDI(usdi_address);
  }

  function register_oracle_master(address master_oracle_address) external override onlyOwner {
    _oracleMaster = OracleMaster(master_oracle_address);

    emit RegisterOracleMaster(master_oracle_address);
  }

  function register_curve_master(address master_curve_address) external override onlyOwner {
    _curveMaster = CurveMaster(master_curve_address);
    emit RegisterCurveMaster(master_curve_address);
  }

  function change_protocol_fee(uint256 new_protocol_fee) external override onlyOwner {
    require(new_protocol_fee < 5000, "fee is too large");
    _protocolFee = new_protocol_fee;

    emit NewProtocolFee(_protocolFee);
  }

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

  function checkAccount(uint256 id) external view override returns (bool) {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    IVault vault = IVault(vault_address);
    uint256 total_liquidity_value = get_vault_borrowing_power(vault);
    uint256 usdi_liability = truncate((vault.BaseLiability() * _interestFactor));
    return (total_liquidity_value >= usdi_liability);
  }

  function borrowUsdi(uint256 id, uint256 amount) external override paysInterest whenNotPaused {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x00), "vault does not exist");
    IVault vault = IVault(vault_address);

    require(_msgSender() == vault.Minter(), "sender not creator");

    uint256 base_amount = div_(amount * 1e18, _interestFactor);
    uint256 base_liability = vault.increase_liability(base_amount);

    _totalBaseLiability = _totalBaseLiability + base_amount;

    uint256 usdi_liability = truncate((_interestFactor - 1) * base_liability);

    uint256 total_liquidity_value = get_vault_borrowing_power(vault);

    require(total_liquidity_value >= usdi_liability, "account insolvent");

    _usdi.vault_master_mint(_msgSender(), _AccountLiability(id));

    emit BorrowUSDi(id, vault_address, _AccountLiability(id));
  }

  function repayUSDi(uint256 id, uint256 amount) external override paysInterest whenNotPaused {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    IVault vault = IVault(vault_address);

    uint256 base_amount = div_(amount * 1e18, _interestFactor);
    _totalBaseLiability = _totalBaseLiability - base_amount;
    require(base_amount <= vault.BaseLiability(), "repay > borrow amount");
    vault.decrease_liability(base_amount);
    _usdi.vault_master_burn(_msgSender(), amount);
    emit RepayUSDi(id, vault_address, amount);
  }

  function repayAllUSDi(uint256 id) external override paysInterest whenNotPaused {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    IVault vault = IVault(vault_address);

    Exp memory interest_factor = Exp({mantissa: _interestFactor});
    uint256 usdi_liability = truncate(ExponentialNoError.mul_ScalarTruncate(interest_factor, vault.BaseLiability()));
    vault.decrease_liability(vault.BaseLiability());
    _usdi.vault_master_burn(_msgSender(), usdi_liability);

    emit RepayUSDi(id, vault_address, usdi_liability);
  }

  ///@param tokens_to_liquidate - number of tokens to liquidate
  function liquidate_account(
    uint256 id,
    address asset_address,
    uint256 tokens_to_liquidate
  ) external override paysInterest whenNotPaused returns (uint256) {
    (uint256 tokenAmount, uint256 badFillPrice) = _liquidationMath(id, asset_address, tokens_to_liquidate);

    if (tokenAmount != 0) {
      tokens_to_liquidate = tokenAmount;
    }

    uint256 usdi_to_repurchase = truncate(badFillPrice * tokens_to_liquidate);
    IVault vault = getVault(id);

    //decrease by base amount -- switch to truncate?
    vault.decrease_liability(div_(usdi_to_repurchase * 1e18, _interestFactor));

    //decrease liquidators usdi balance
    _usdi.vault_master_burn(_msgSender(), usdi_to_repurchase);

    // finally, we deliver the tokens to the liquidator
    vault.masterTransfer(asset_address, _msgSender(), tokens_to_liquidate);

    require(get_vault_borrowing_power(vault) <= _AccountLiability(id), "overliquidation");
    emit Liquidate(id, asset_address, usdi_to_repurchase, tokens_to_liquidate);
    return tokens_to_liquidate;
  }

  /******* getters things *******/

  ///@dev - returns the amount of tokens underwater this vault is
  ///@dev - the amount owed is a moving target and changes with each block
  function TokensToLiquidate(
    uint256 id,
    address asset_address,
    uint256 tokens_to_liquidate
  ) public view override returns (uint256) {
    (
      uint256 tokenAmount, /*uint256 badFillPrice*/

    ) = _liquidationMath(id, asset_address, tokens_to_liquidate);

    return tokenAmount;
  }

  function _liquidationMath(
    uint256 id,
    address asset_address,
    uint256 tokens_to_liquidate
  ) internal view returns (uint256, uint256) {
    IVault vault = getVault(id);

    //get the price of the asset scaled to decimal 18
    uint256 price = _oracleMaster.getLivePrice(asset_address);

    // liquidation penalty
    uint256 badFillPrice = truncate(price * (1e18 - _tokenAddress_liquidationIncentive[asset_address]));

    uint256 denominator = truncate(
      price *
        ((1e18 - _tokenAddress_liquidationIncentive[asset_address]) -
          _tokenId_tokenLTV[_tokenAddress_tokenId[asset_address]])
    );
    uint256 max_tokens_to_liquidate = truncate(
      ((_AccountLiability(id) - get_vault_borrowing_power(vault)) * 1e36) / denominator
    );

    //if ideal amount isnt possible update with vault balance
    if (tokens_to_liquidate > max_tokens_to_liquidate) {
      tokens_to_liquidate = max_tokens_to_liquidate;
    }

    //if ideal amount isnt possible update with vault balance
    if (tokens_to_liquidate > vault.tokenBalance(asset_address)) {
      tokens_to_liquidate = vault.tokenBalance(asset_address);
    }
    return (tokens_to_liquidate, badFillPrice);
  }

  function getVault(uint256 id) internal view returns (IVault vault) {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    vault = IVault(vault_address);
  }

  function AccountLiability(uint256 id) external view override returns (uint256) {
    return _AccountLiability(id);
  }

  function _AccountLiability(uint256 id) internal view returns (uint256) {
    address vault_address = _vaultId_vaultAddress[id];
    require(vault_address != address(0x0), "vault does not exist");
    IVault vault = IVault(vault_address);
    return truncate(vault.BaseLiability() * _interestFactor);
  }

  function AccountBorrowingPower(uint256 id) external view override returns (uint256) {
    return get_vault_borrowing_power(IVault(_vaultId_vaultAddress[id]));
  }

  ///@dev total_liquidity_value
  function get_vault_borrowing_power(IVault vault) private view returns (uint256) {
    uint256 total_liquidity_value = 0;
    for (uint256 i = 1; i <= _tokensRegistered; i++) {
      address token_address = _enabledTokens[i - 1];
      uint256 raw_price = uint256(_oracleMaster.getLivePrice(token_address));
      if (raw_price != 0) {
        uint256 balance = vault.tokenBalance(token_address);
        uint256 token_value = truncate(truncate(raw_price * balance * _tokenId_tokenLTV[i]));
        total_liquidity_value = total_liquidity_value + token_value;
      }
    }
    return total_liquidity_value;
  }

  /******* calculate and pay interest *******/
  function calculateInterest() external override returns (uint256) {
    return pay_interest();
  }

  function pay_interest() private returns (uint256) {
    uint256 timeDifference = block.timestamp - _lastInterestTime;
    if (timeDifference == 0) {
      return 0;
    }
    int256 reserve_ratio = int256(_usdi.reserveRatio());
    int256 int_curve_val = _curveMaster.getValueAt(address(0x00), reserve_ratio);
    require(int_curve_val >= 0, "rate too small");

    uint256 curve_val = uint256(int_curve_val);

    uint256 e18_factor_increase = truncate(
      truncate((timeDifference * 1e18 * curve_val) / (365 days + 6 hours)) * _interestFactor
    );

    uint256 valueBefore = truncate(_totalBaseLiability * _interestFactor);
    _interestFactor = _interestFactor + e18_factor_increase;
    uint256 valueAfter = truncate(_totalBaseLiability * _interestFactor);

    if (valueAfter > valueBefore) {
      uint256 protocolAmount = truncate((valueAfter - valueBefore) * (_protocolFee));
      _usdi.vault_master_donate(valueAfter - valueBefore - protocolAmount);
      _usdi.vault_master_mint(owner(), protocolAmount);
    }
    _lastInterestTime = block.timestamp;
    emit Interest(block.timestamp, e18_factor_increase, curve_val);
    return e18_factor_increase;
  }
}
