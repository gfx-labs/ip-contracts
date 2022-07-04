// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../_external/IERC20Metadata.sol";
import "../_external/openzeppelin/ERC20Upgradeable.sol";
import "../_external/openzeppelin/OwnableUpgradeable.sol";
import "../_external/openzeppelin/Initializable.sol";

/// @title CappedToken
/// @notice handles all minting/burning of underlying
/// @dev extends ierc20 upgradable
contract RebasingCapped is Initializable, OwnableUpgradeable,  ERC20Upgradeable {
  IERC20Metadata public _underlying;
  uint256 constant UNDERLYING_SCALAR = 1;

  /// @notice CAP is in units of the CAP token,so 18 decimals.
  ///         not the underlying!!!!!!!!!
  uint256 public _cap;

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ the address of underlying
  function initialize(string memory name_, string memory symbol_, address underlying_) public override initializer {
    __OwnableUpgradeable_init();
    __ERC20_init(name_,symbol_);
    _underlying = IERC20Metadata(underlying_);
  }

  /// @notice 18 decimal erc20 spec should have been written into the fucking standard
  function decimals() public pure override returns (uint8) {
    return 18;
  }

  /// @notice get the Cap
  /// @return cap uint256
  function getCap() public view override returns (uint256) {
    return _cap;
  }
  /// @notice set the Cap
  function setCap(uint256 cap_) external override onlyOwner {
    _cap = cap_;
  }
  function checkCap(uint256 amount_) internal view returns (bool) {
    require(ERC20Upgradeable.totalSupply() + amount_ <= _cap, "cap reached");
  }

  /// @notice get underlying ratio
  /// @return amount amount of this CappedToken
  function underlyingToCappedAmount(uint256 underlying_amount) internal view returns (uint256 amount) {
    amount = UNDERLYING_SCALAR * underlying_amount;
  }

  function cappedAmountToUnderlying(uint256 amount) internal view returns (uint256 amount) {
    amount = underlying_amount / UNDERLYING_SCALAR;
  }

  /// @notice deposit _underlying to mint CappedToken
  /// @param underlying_amount amount of underlying to deposit
  /// @param target recipient of tokens
  function deposit(uint256 underlying_amount, address target) public override   {
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
  /// @param underlying_amount amount of underlying to withdraw
  function withdraw(uint256 underlying_amount, address target) public override   {
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

  // EIP-4626 compliance, sorry it's not the most gas efficient.

  function asset() external view returns (address) {
    return address(_underlying);
  }
  function totalAssets() public view returns (uint256) {
    return underlying.balanceOf(address(this));
  }

  function convertToShares(assets uint256) external view returns (uint256) {
    return underlyingToCappedAmount(assets);
  }
  function convertToAssets(shares uint256) external view returns (uint256) {
    return cappedAmountToUnderlying(assets);
  }

  function maxDeposit(receiver address) public view returns(uint256) {
    uint256 remaining = (_cap - (totalAssets() * UNDERLYING_SCALAR))/UNDERLYING_SCALAR;
    if(remaining < _underlying.balanceOf(receiver)){
      return _underlying.balanceOf(receiver));
    }
    return remaining
  }
  function previewDeposit(assets uint256) public view returns (uint256) {
    return underlyingToCappedAmount(assets);
  }
  //function deposit - already implemented

  function maxMint(receiver address) external view returns (uint256) {
    return cappedAmountToUnderlying(maxDeposit(address));
  }
  function previewMint(shares uint256) external view returns(uint256) {
    return cappedAmountToUnderlying(previewDeposit(address));
  }
  function mint(shares uint256, receiver address) external {
    return deposit(cappedAmountToUnderlying(shares), receiver);
  }

  function maxWithdraw(receiver address) public view returns(uint256) {
    uint256 receiver_can = (ERC20Upgradeable.balanceOf(receiver) / UNDERLYING_SCALAR);
    if(receiver_can > _underlying.balanceOf(address(this))){
      return _underlying.balanceOf(address(this)));
    }
    return receiver_can;
  }
  function previewWithdraw(assets uint256) public view returns (uint256) {
    return underlyingToCappedAmount(assets);
  }
  //function withdraw - already implemented

  function maxRedeem(receiver address) external view returns (uint256) {
    return cappedAmountToUnderlying(maxWithdraw(address));
  }
  function previewRedeem(shares uint256) external view returns(uint256) {
    return cappedAmountToUnderlying(previewWithdraw(address));
  }
  function redeem(shares uint256, receiver address) external {
    return withdraw(cappedAmountToUnderlying(shares), receiver);
  }
}
