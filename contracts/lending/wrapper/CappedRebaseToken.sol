// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../IVaultController.sol";
import "../IVault.sol";

import "../../_external/IERC20Metadata.sol";
import "../../_external/openzeppelin/ERC20Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";
import "../../_external/openzeppelin/SafeERC20Upgradeable.sol";

/// @title Capped Rebase Token
/// @notice handles all minting/burning of underlying rebasing token
/// @dev extends ierc20 upgradable
contract CappedRebaseToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  using SafeERC20Upgradeable for ERC20Upgradeable;

  ERC20Upgradeable public _underlying;
  IVaultController public _vaultController;

  // in actual units
  uint256 public _cap;

  /// @notice This must remain constant for conversions to work, the cap is separate
  uint256 public constant MAX_SUPPLY = 10000000 * (10 ** 18); // 10 M

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ the address of underlying
  /// @param vaultController_ the address of vault controller
  function initialize(
    string memory name_,
    string memory symbol_,
    address underlying_,
    address vaultController_
  ) public initializer {
    __Ownable_init();
    __ERC20_init(name_, symbol_);
    _underlying = ERC20Upgradeable(underlying_);

    _vaultController = IVaultController(vaultController_);
  }

  /// @notice 18 decimal erc20 spec should have been written into the fucking standard
  function decimals() public pure override returns (uint8) {
    return 18;
  }

  /// @notice NOTE cap is in underlying terms NOT IN WRAPPED TERMS
  /// @return cap uint256
  function getCap() public view returns (uint256) {
    return _cap;
  }

  ///@notice refund any tokens stuck on the contract
  function sweep(ERC20Upgradeable token, address recipient, uint256 amount) external onlyOwner {
    token.safeTransfer(recipient, amount);
  }

  /// @notice set the Cap
  /// @notice NOTE cap is in underlying terms NOT IN WRAPPED TERMS
  function setCap(uint256 cap_) external onlyOwner {
    _cap = cap_;
  }

  /// @notice because this wrapper holds the underlying rebase token,
  /// we can simply compare input amount + current holdings
  /// to determine if cap has been reached
  /// NOTE @param amount_ is in underlying terms NOT WRAPPED TERMS
  function checkCap(uint256 amount_) internal view {
    require(_underlying.balanceOf(address(this)) + amount_ <= _cap, "cap reached");
  }

  /// @notice deposit _underlying to mint CappedToken
  /// @param amount of underlying to deposit
  /// @param vaultId recipient vault of tokens
  function deposit(uint256 amount, uint96 vaultId) public {
    //verify vault
    require(amount > 0, "Cannot deposit 0");
    IVault vault = IVault(_vaultController.vaultAddress(vaultId));
    require(address(vault) != address(0x0), "invalid vault");
    // check cap
    checkCap(amount);
    // check allowance and ensure transfer success
    uint256 allowance = _underlying.allowance(_msgSender(), address(this));
    require(allowance >= amount, "Insufficient Allowance");
    //calculate the amount of wrapper tokens to mint to the standard vault
    uint256 wrappedAmount = _underlying_to_capped(amount, _underlying.totalSupply());
    //take tokens and wrap
    _deposit(_msgSender(), address(vault), amount, wrappedAmount);
  }

  ///@notice because these tokens only exist in the vault, we can override balanceOf
  /// and simply account in only the underlying balance and not worry about the wrapper balance.
  /// To get the wrapper balance, we can plug the underlying balance into
  /// function underlyingToWrapper(<underlying balance>)
  function balanceOf(address account) public view override returns (uint256 balance) {
    return _capped_to_underlying(super.balanceOf(account), _query_Underlying_Supply());
  }

  ///@notice for withdrawals,
  ///@param amount is in UNDERLYING terms, not wrapper terms
  function transfer(address recipient, uint256 amount) public override returns (bool) {
    //get vault info
    IVault vault = IVault(_msgSender());
    // only vaults will ever send this. only vaults will ever hold this token.
    require(vault.id() > 0, "only vaults");
    //calculate the amount of wrapper tokens to burn from the standard vault
    uint256 wraperAmount = _underlying_to_capped(amount, _underlying.totalSupply());
    //burn and unwrap
    _withdraw(address(vault), recipient, amount, wraperAmount);
    return true;
  }

  function transferFrom(
    address /*sender*/,
    address /*recipient*/,
    uint256 /*amount*/
  ) public pure override returns (bool) {
    // allowances are never granted
    // this function is therefore always uncallable and so we will just return false
    return false;
  }

  /// @dev Internal helper function to handle deposit state change.
  /// @param from The initiator wallet.
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to deposit.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to mint.
  function _deposit(address from, address to, uint256 underlyingAmount, uint256 cappedTokenAmount) private {
    _mint(to, cappedTokenAmount);
    _underlying.safeTransferFrom(from, address(this), underlyingAmount);
  }

  /// @dev Internal helper function to handle withdraw state change.
  /// @param from The initiator wallet.
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to withdraw.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to burn.
  function _withdraw(address from, address to, uint256 underlyingAmount, uint256 cappedTokenAmount) private {
    _burn(from, cappedTokenAmount);
    _underlying.safeTransfer(to, underlyingAmount);
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
    return _capped_to_underlying(super.balanceOf(owner), _query_Underlying_Supply());
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
  function _underlying_to_capped(
    uint256 underlyingAmount,
    uint256 underlyingTotalSupply
  ) private pure returns (uint256) {
    return (underlyingAmount * MAX_SUPPLY) / underlyingTotalSupply;
  }

  function _capped_to_underlying(uint256 cappedAmount, uint256 underlyingTotalSupply) private pure returns (uint256) {
    return (cappedAmount * underlyingTotalSupply) / MAX_SUPPLY;
  }
}
