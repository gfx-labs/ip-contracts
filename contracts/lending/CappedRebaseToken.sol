// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../_external/IERC20Metadata.sol";
import "../_external/openzeppelin/ERC20Upgradeable.sol";
import "../_external/openzeppelin/OwnableUpgradeable.sol";
import "../_external/openzeppelin/Initializable.sol";

import {SafeERC20} from "../_external/extensions/SafeERC20.sol";

import "hardhat/console.sol";

/// @title CappedRebaseToken - uses logic from Wrapped USDI which uses logic from WAMPL 
/// @notice handles all minting/burning of underlying
/// @dev extends ierc20 upgradable
contract CappedRebaseToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  using SafeERC20 for IERC20;

  IERC20Metadata public _underlying;
  uint8 private _underlying_decimals;

  uint256 public _cap;

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ the address of underlying
  function initialize(
    string memory name_,
    string memory symbol_,
    address underlying_
  ) public initializer {
    __Ownable_init();
    __ERC20_init(name_, symbol_);
    _underlying = IERC20Metadata(underlying_);
    _underlying_decimals = _underlying.decimals();
  }

  /// @notice getter for address of the underlying currency, or underlying
  /// @return decimals for of underlying currency
  function underlyingAddress() public view returns (address) {
    return address(_underlying);
  }

  ///////////////////////// CAP FUNCTIONS /////////////////////////
  /// @notice get the Cap
  /// @return cap
  function getCap() public view returns (uint256) {
    return _cap;
  }

  /// @notice set the Cap
  function setCap(uint256 cap_) external onlyOwner {
    _cap = cap_;
  }

  function checkCap(uint256 amount_) internal view {
    require(ERC20Upgradeable.totalSupply() + amount_ <= _cap, "cap reached");
  }

  function decimals() public pure override returns (uint8) {
    return 18;
  }

  function underlyingScalar() public view returns (uint256) {
    return (10**(18 - _underlying_decimals));
  }

  /// @notice get underlying ratio
  /// @return e18_underlying_ratio underlying ratio of coins
  function underlyingRatio() public view returns (uint256 e18_underlying_ratio) {
    e18_underlying_ratio = (((_underlying.balanceOf(address(this)) * underlyingScalar()) * 1e18) /
      _underlying.totalSupply());
  }

  /// @notice get underlying ratio
  /// @return amount amount of this CappedToken
  function underlyingToCappedAmount(uint256 underlying_amount) internal view returns (uint256 amount) {
    // using tokens UNDER and CAP , this statement is
    // underlying_amount * (1e18 * (10^(18 - UNDER.decimals)) * (1e18 * UNDER.balanceOf(this) / CAP.totalSupply))
    // = underlying_amount * (scalar * underlying_balance / capped_totalsupply) * underlying_amount / 1e18;
    // = underlying_amount * (scalar * ratioe18) * underlying_amount / 1e18
    // we must multiply by the underlyingScalar at the end since our answer is in CapToken amounts, not underlying amounts.

    ///bug this underlyingRatio is 0 before first deposit, so depositing will always revert with "Cannot deposit 0" line 98
    amount = (underlyingScalar() * underlyingRatio() * underlying_amount) / 1e18;
    console.log("amount: ", amount);
  }

  ///////////////////////// WRAP AND UNWRAP /////////////////////////

  //supply cappedTokenUnits

  /// @notice Transfers underlyingAmount from {msg.sender} and mints cappedTokenAmount.
  ///
  /// @param cappedTokenAmount The amount of cappedTokens to mint.
  /// @return The amount of underlyingAmount deposited.
  function mint(uint256 cappedTokenAmount) external returns (uint256) {
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _deposit(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Transfers underlyingAmount from {msg.sender} and mints cappedTokenAmount,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to mint.
  /// @return The amount of underlyingAmount deposited.
  function mintFor(address to, uint256 cappedTokenAmount) external returns (uint256) {
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _deposit(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Burns cappedTokenAmount from {msg.sender} and transfers underlyingAmount back.
  ///
  /// @param cappedTokenAmount The amount of cappedTokenAmount to burn.
  /// @return The amount of usdi withdrawn.
  function burn(uint256 cappedTokenAmount) external returns (uint256) {
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Burns cappedTokenAmount from {msg.sender} and transfers underlyingAmount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to burn.
  /// @return The amount of underlyingAmount withdrawn.
  function burnTo(address to, uint256 cappedTokenAmount) external returns (uint256) {
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Burns all cappedTokenAmount from {msg.sender} and transfers underlyingAmount back.
  ///
  /// @return The amount of underlyingAmount withdrawn.
  function burnAll() external returns (uint256) {
    uint256 cappedTokenAmount = balanceOf(_msgSender());
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Burns all cappedTokenAmount from {msg.sender} and transfers underlyingAmount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @return The amount of underlyingAmount withdrawn.
  function burnAllTo(address to) external returns (uint256) {
    uint256 cappedTokenAmount = balanceOf(_msgSender());
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  //supply underlying units

  /// @notice Transfers underlyingAmount from {msg.sender} and mints cappedTokenAmount.
  ///
  /// @param underlyingAmount The amount of underlyingAmount to deposit.
  /// @return The amount of cappedTokenAmount minted.
  function deposit(uint256 underlyingAmount) external returns (uint256) {
    uint256 cappedTokenAmount = _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
    _deposit(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Transfers underlyingAmount from {msg.sender} and mints cappedTokenAmount,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to deposit.
  /// @return The amount of cappedTokenAmount minted.
  function depositFor(address to, uint256 underlyingAmount) external returns (uint256) {
    uint256 cappedTokenAmount = _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
    _deposit(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Burns cappedTokenAmount from {msg.sender} and transfers underlyingAmount back.
  ///
  /// @param underlyingAmount The amount of underlyingAmount to withdraw.
  /// @return The amount of burnt cappedTokenAmount.
  function withdraw(uint256 underlyingAmount) external returns (uint256) {
    uint256 cappedTokenAmount = _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Burns cappedTokenAmount from {msg.sender} and transfers underlyingAmount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to withdraw.
  /// @return The amount of burnt cappedTokenAmount.
  function withdrawTo(address to, uint256 underlyingAmount) external returns (uint256) {
    uint256 cappedTokenAmount = _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Burns all cappedTokenAmount from {msg.sender} and transfers underlyingAmount back.
  ///
  /// @return The amount of burnt cappedTokenAmount.
  function withdrawAll() external returns (uint256) {
    uint256 cappedTokenAmount = balanceOf(_msgSender());
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());

    console.log("cappedTokenAmount: ", cappedTokenAmount);
    console.log("underlyingAmount : ", underlyingAmount);
    console.log("Underlying held: ", _underlying.balanceOf(address(this)));

    require(underlyingAmount <= _underlying.balanceOf(address(this)), "Insufficient funds in bank");


    _withdraw(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Burns all cappedTokenAmount from {msg.sender} and transfers underlyingAmount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @return The amount of burnt cappedTokenAmount.
  function withdrawAllTo(address to) external returns (uint256) {
    uint256 cappedTokenAmount = balanceOf(_msgSender());
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  ///////////////////////// VIEW FUNCTIONS /////////////////////////

  /// @return The address of the underlying "wrapped" token ie) usdi.
  function underlying() external view returns (address) {
    return address(_underlying);
  }

  /// @return The total underlyingAmount held by this contract.
  function totalUnderlying() external view returns (uint256) {
    return _underlying_to_capped(totalSupply(), _query_Underlying_Supply());
  }

  /// @param owner The account address.
  /// @return The usdi balance redeemable by the owner.
  function balanceOfUnderlying(address owner) external view returns (uint256) {
    return _capped_to_underlying(balanceOf(owner), _query_Underlying_Supply());
  }

  /// @param underlyingAmount The amount of usdi tokens.
  /// @return The amount of wUSDI tokens exchangeable.
  function underlyingToWrapper(uint256 underlyingAmount) external view returns (uint256) {
    return _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
  }

  /// @param cappedAmount The amount of wUSDI tokens.
  /// @return The amount of usdi tokens exchangeable.
  function wrapperToUnderlying(uint256 cappedAmount) external view returns (uint256) {
    return _capped_to_underlying(cappedAmount, _query_Underlying_Supply());
  }

  ///////////////////////// CONVERSION MATH /////////////////////////

  /// @dev Queries the current total supply of underlying rebase token.
  function _query_Underlying_Supply() private view returns (uint256) {
    return _underlying.totalSupply();
  }

  /// @notice assumes underlying is decimal 18
  function _underlying_to_capped(uint256 underlyingAmount, uint256 underlyingTotalSupply)
    private
    view
    returns (uint256)
  {
    return (underlyingAmount * _cap) / underlyingTotalSupply;
  }

  function _capped_to_underlying(uint256 cappedAmount, uint256 underlyingTotalSupply) private view returns (uint256) {
    return (cappedAmount * underlyingTotalSupply) / _cap;
  }

  /// @dev Internal helper function to handle deposit state change.
  /// @param from The initiator wallet.
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to deposit.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to mint.
  function _deposit(
    address from,
    address to,
    uint256 underlyingAmount,
    uint256 cappedTokenAmount
  ) private {
    IERC20(address(_underlying)).safeTransferFrom(from, address(this), underlyingAmount);

    _mint(to, cappedTokenAmount);
  }

  /// @dev Internal helper function to handle withdraw state change.
  /// @param from The initiator wallet.
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to withdraw.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to burn.
  function _withdraw(
    address from,
    address to,
    uint256 underlyingAmount,
    uint256 cappedTokenAmount
  ) private {
    _burn(from, cappedTokenAmount);

    IERC20(address(_underlying)).safeTransfer(to, underlyingAmount);
  }
  ///////////////////////// OLD /////////////////////////

  /**
  /// @notice deposit _underlying to mint CappedToken
  /// @param underlying_amount amount of underlying to deposit
  /// @param target recipient of tokens
  function depositTo(uint256 underlying_amount, address target) public {
    // scale the decimals to THIS token decimals, or 1e18. see underlyingToCappedAmount
    uint256 amount = underlyingToCappedAmount(underlying_amount);
    require(amount > 0, "Cannot deposit 0");
    // check cap
    checkCap(amount);
    // check allowance and ensure transfer success
    uint256 allowance = _underlying.allowance(_msgSender(), address(this));
    require(allowance >= underlying_amount, "Insufficient Allowance");
    // mint the scaled amount of tokens to the TARGET
    ERC20Upgradeable._mint(target, amount);
    // transfer underlying from SENDER to THIS
    require(_underlying.transferFrom(_msgSender(), address(this), underlying_amount), "transfer failed");
  }

  /// @notice withdraw underlying by burning THIS token
  /// caller should obtain 1 underlying for every underlyingScalar() THIS token
  /// this is just withdrawTo but with the second address as _msgSender;
  /// @param underlying_amount amount of underlying to withdraw
  function withdraw(uint256 underlying_amount) external {
    withdrawTo(underlying_amount, _msgSender());
  }

  /// @notice withdraw underlying by burning THIS token
  /// caller should obtain 1 underlying for every underlyingScalar() THIS token
  /// @param underlying_amount amount of underlying to withdraw
  function withdrawTo(uint256 underlying_amount, address target) public {
    // scale the underlying_amount to the THIS token decimal amount, aka 1e18
    uint256 amount = underlyingToCappedAmount(underlying_amount);
    // check balances all around
    require(amount <= this.balanceOf(_msgSender()), "insufficient funds");
    require(amount > 0, "Cannot withdraw 0");
    uint256 balance = _underlying.balanceOf(address(this));
    require(balance >= underlying_amount, "Insufficient underlying in Bank");
    // burn the scaled amount of tokens from the SENDER
    ERC20Upgradeable._burn(_msgSender(), amount);
    // transfer underlying to the TARGET
    require(_underlying.transfer(target, underlying_amount), "transfer failed");
  }
   */
}
