// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../_external/IERC20Metadata.sol";
import "../_external/openzeppelin/ERC20Upgradeable.sol";
import "../_external/openzeppelin/OwnableUpgradeable.sol";
import "../_external/openzeppelin/Initializable.sol";

import "hardhat/console.sol";

/// @title CappedToken
/// @notice handles all minting/burning of underlying
/// @dev extends ierc20 upgradable
contract RebasingCapped is Initializable, OwnableUpgradeable, ERC20Upgradeable {
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
  /// @return amount amount of this CappedToken
  function underlyingToCappedAmount(uint256 underlying_amount) internal view returns (uint256 amount) {
    // using tokens UNDER and CAP , this statement is
    // underlying_amount * (1e18 * (10^(18 - UNDER.decimals)) * (1e18 * UNDER.balanceOf(this) / CAP.totalSupply))
    // = underlying_amount * (scalar * underlying_balance / capped_totalsupply) * underlying_amount / 1e18;
    // = underlying_amount * (scalar * ratioe18) * underlying_amount / 1e18
    // we must multiply by the underlyingScalar at the end since our answer is in CapToken amounts, not underlying amounts.


    ///bug this underlyingRatio is 0 before first deposit, so depositing will always revert with "Cannot deposit 0" line 98
    amount = (underlyingScalar() * underlyingRatio() * underlying_amount) / 1e18;
  }

  /// @notice get underlying ratio
  /// @return e18_underlying_ratio underlying ratio of coins
  function underlyingRatio() public view returns (uint256 e18_underlying_ratio) {
    e18_underlying_ratio = (((_underlying.balanceOf(address(this)) * underlyingScalar()) * 1e18) /
      _underlying.totalSupply());
  }

  /// @notice deposit _underlying to mint CappedToken
  /// this is just depositTo but with the second address as _msgSender;
  /// @param underlying_amount amount of underlying to deposit
  function deposit(uint256 underlying_amount) external {
    depositTo(underlying_amount, _msgSender());
  }

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
}
