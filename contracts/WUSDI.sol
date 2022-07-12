// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.9;

import {IWUSDI} from "./IWUSDI.sol";

import {IERC20} from "./_external/IERC20.sol";

import {SafeERC20} from "./_external/extensions/SafeERC20.sol";
import {ERC20} from "./_external/extensions/ERC20.sol";
// solhint-disable-next-line max-line-length
import {ERC20Permit} from "./_external/extensions/ERC20Permit.sol";

//import "hardhat/console.sol";

/**
 * @title wUSDI (Wrapped usdi).
 *
 * @dev A fixed-balance ERC-20 wrapper for the usdi rebasing token.
 *
 *      Users deposit usdi into this contract and are minted wUSDI.
 *
 *      Each account's wUSDI balance represents the fixed percentage ownership
 *      of usdi's market cap.
 *
 *      For exusdie: 100K wUSDI => 1% of the usdi market cap
 *        when the usdi supply is 100M, 100K wUSDI will be redeemable for 1M usdi
 *        when the usdi supply is 500M, 100K wUSDI will be redeemable for 5M usdi
 *        and so on.
 *
 *      We call wUSDI the "wrapper" token and usdi the "underlying" or "wrapped" token.
 */
contract WUSDI is IWUSDI, ERC20, ERC20Permit {
  using SafeERC20 for IERC20;

  //--------------------------------------------------------------------------
  // Constants

  /// @dev The maximum wUSDI supply.
  uint256 public constant MAX_wUSDI_SUPPLY = 10000000 * (10**18); // 10 M

  //--------------------------------------------------------------------------
  // Attributes

  /// @dev The reference to the usdi token.
  address private immutable _usdi;

  //--------------------------------------------------------------------------

  /// @param usdi The usdi ERC20 token address.
  /// @param name_ The wUSDI ERC20 name.
  /// @param symbol_ The wUSDI ERC20 symbol.
  constructor(
    address usdi,
    string memory name_,
    string memory symbol_
  ) ERC20(name_, symbol_) ERC20Permit(name_) {
    _usdi = usdi;
  }

  //--------------------------------------------------------------------------
  // wUSDI write methods

  /// @notice Transfers usdi_amount from {msg.sender} and mints wUSDI_amount.
  ///
  /// @param wUSDI_amount The amount of wUSDI_amount to mint.
  /// @return The amount of usdi_amount deposited.
  function mint(uint256 wUSDI_amount) external override returns (uint256) {
    uint256 usdi_amount = _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());
    _deposit(_msgSender(), _msgSender(), usdi_amount, wUSDI_amount);
    return usdi_amount;
  }

  /// @notice Transfers usdi_amount from {msg.sender} and mints wUSDI_amount,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param wUSDI_amount The amount of wUSDI_amount to mint.
  /// @return The amount of usdi_amount deposited.
  function mintFor(address to, uint256 wUSDI_amount) external override returns (uint256) {
    uint256 usdi_amount = _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());
    _deposit(_msgSender(), to, usdi_amount, wUSDI_amount);
    return usdi_amount;
  }

  /// @notice Burns wUSDI_amount from {msg.sender} and transfers usdi_amount back.
  ///
  /// @param wUSDI_amount The amount of wUSDI_amount to burn.
  /// @return The amount of usdi withdrawn.
  function burn(uint256 wUSDI_amount) external override returns (uint256) {
    uint256 usdi_amount = _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());
    _withdraw(_msgSender(), _msgSender(), usdi_amount, wUSDI_amount);
    return usdi_amount;
  }

  /// @notice Burns wUSDI_amount from {msg.sender} and transfers usdi_amount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param wUSDI_amount The amount of wUSDI_amount to burn.
  /// @return The amount of usdi_amount withdrawn.
  function burnTo(address to, uint256 wUSDI_amount) external override returns (uint256) {
    uint256 usdi_amount = _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());
    _withdraw(_msgSender(), to, usdi_amount, wUSDI_amount);
    return usdi_amount;
  }

  /// @notice Burns all wUSDI_amount from {msg.sender} and transfers usdi_amount back.
  ///
  /// @return The amount of usdi_amount withdrawn.
  function burnAll() external override returns (uint256) {
    uint256 wUSDI_amount = balanceOf(_msgSender());
    uint256 usdi_amount = _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());
    _withdraw(_msgSender(), _msgSender(), usdi_amount, wUSDI_amount);
    return usdi_amount;
  }

  /// @notice Burns all wUSDI_amount from {msg.sender} and transfers usdi_amount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @return The amount of usdi_amount withdrawn.
  function burnAllTo(address to) external override returns (uint256) {
    uint256 wUSDI_amount = balanceOf(_msgSender());
    uint256 usdi_amount = _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());
    _withdraw(_msgSender(), to, usdi_amount, wUSDI_amount);
    return usdi_amount;
  }

  /// @notice Transfers usdi_amount from {msg.sender} and mints wUSDI_amount.
  ///
  /// @param usdi_amount The amount of usdi_amount to deposit.
  /// @return The amount of wUSDI_amount minted.
  function deposit(uint256 usdi_amount) external override returns (uint256) {
    uint256 wUSDI_amount = _usdi_to_wUSDI(usdi_amount, _query_USDi_Supply());
    _deposit(_msgSender(), _msgSender(), usdi_amount, wUSDI_amount);
    return wUSDI_amount;
  }

  /// @notice Transfers usdi_amount from {msg.sender} and mints wUSDI_amount,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param usdi_amount The amount of usdi_amount to deposit.
  /// @return The amount of wUSDI_amount minted.
  function depositFor(address to, uint256 usdi_amount) external override returns (uint256) {
    uint256 wUSDI_amount = _usdi_to_wUSDI(usdi_amount, _query_USDi_Supply());
    _deposit(_msgSender(), to, usdi_amount, wUSDI_amount);
    return wUSDI_amount;
  }

  /// @notice Burns wUSDI_amount from {msg.sender} and transfers usdi_amount back.
  ///
  /// @param usdi_amount The amount of usdi_amount to withdraw.
  /// @return The amount of burnt wUSDI_amount.
  function withdraw(uint256 usdi_amount) external override returns (uint256) {
    uint256 wUSDI_amount = _usdi_to_wUSDI(usdi_amount, _query_USDi_Supply());
    _withdraw(_msgSender(), _msgSender(), usdi_amount, wUSDI_amount);
    return wUSDI_amount;
  }

  /// @notice Burns wUSDI_amount from {msg.sender} and transfers usdi_amount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param usdi_amount The amount of usdi_amount to withdraw.
  /// @return The amount of burnt wUSDI_amount.
  function withdrawTo(address to, uint256 usdi_amount) external override returns (uint256) {
    uint256 wUSDI_amount = _usdi_to_wUSDI(usdi_amount, _query_USDi_Supply());
    _withdraw(_msgSender(), to, usdi_amount, wUSDI_amount);
    return wUSDI_amount;
  }

  /// @notice Burns all wUSDI_amount from {msg.sender} and transfers usdi_amount back.
  ///
  /// @return The amount of burnt wUSDI_amount.
  function withdrawAll() external override returns (uint256) {
    uint256 wUSDI_amount = balanceOf(_msgSender());
    uint256 usdi_amount = _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());

    _withdraw(_msgSender(), _msgSender(), usdi_amount, wUSDI_amount);
    return wUSDI_amount;
  }

  /// @notice Burns all wUSDI_amount from {msg.sender} and transfers usdi_amount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @return The amount of burnt wUSDI_amount.
  function withdrawAllTo(address to) external override returns (uint256) {
    uint256 wUSDI_amount = balanceOf(_msgSender());
    uint256 usdi_amount = _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());
    _withdraw(_msgSender(), to, usdi_amount, wUSDI_amount);
    return wUSDI_amount;
  }

  //--------------------------------------------------------------------------
  // wUSDI view methods

  /// @return The address of the underlying "wrapped" token ie) usdi.
  function underlying() external view override returns (address) {
    return _usdi;
  }

  /// @return The total usdi_amount held by this contract.
  function totalUnderlying() external view override returns (uint256) {
    return _wUSDI_to_USDI(totalSupply(), _query_USDi_Supply());
  }

  /// @param owner The account address.
  /// @return The usdi balance redeemable by the owner.
  function balanceOfUnderlying(address owner) external view override returns (uint256) {
    return _wUSDI_to_USDI(balanceOf(owner), _query_USDi_Supply());
  }

  /// @param usdi_amount The amount of usdi tokens.
  /// @return The amount of wUSDI tokens exchangeable.
  function underlyingToWrapper(uint256 usdi_amount) external view override returns (uint256) {
    return _usdi_to_wUSDI(usdi_amount, _query_USDi_Supply());
  }

  /// @param wUSDI_amount The amount of wUSDI tokens.
  /// @return The amount of usdi tokens exchangeable.
  function wrapperToUnderlying(uint256 wUSDI_amount) external view override returns (uint256) {
    return _wUSDI_to_USDI(wUSDI_amount, _query_USDi_Supply());
  }

  //--------------------------------------------------------------------------
  // Private methods

  /// @dev Internal helper function to handle deposit state change.
  /// @param from The initiator wallet.
  /// @param to The beneficiary wallet.
  /// @param usdi_amount The amount of usdi_amount to deposit.
  /// @param wUSDI_amount The amount of wUSDI_amount to mint.
  function _deposit(
    address from,
    address to,
    uint256 usdi_amount,
    uint256 wUSDI_amount
  ) private {
    IERC20(_usdi).safeTransferFrom(from, address(this), usdi_amount);

    _mint(to, wUSDI_amount);
  }

  /// @dev Internal helper function to handle withdraw state change.
  /// @param from The initiator wallet.
  /// @param to The beneficiary wallet.
  /// @param usdi_amount The amount of usdi_amount to withdraw.
  /// @param wUSDI_amount The amount of wUSDI_amount to burn.
  function _withdraw(
    address from,
    address to,
    uint256 usdi_amount,
    uint256 wUSDI_amount
  ) private {
    _burn(from, wUSDI_amount);

    IERC20(_usdi).safeTransfer(to, usdi_amount);
  }

  /// @dev Queries the current total supply of usdi.
  /// @return The current usdi supply.
  function _query_USDi_Supply() private view returns (uint256) {
    return IERC20(_usdi).totalSupply();
  }

  //--------------------------------------------------------------------------
  // Pure methods

  /// @dev Converts usdi_amount to wUSDI amount.
  function _usdi_to_wUSDI(uint256 usdi_amount, uint256 total_usdi_supply) private pure returns (uint256) {
    return (usdi_amount * MAX_wUSDI_SUPPLY) / total_usdi_supply;
  }

  /// @dev Converts wUSDI_amount amount to usdi_amount.
  function _wUSDI_to_USDI(uint256 wUSDI_amount, uint256 total_usdi_supply) private pure returns (uint256) {
    return (wUSDI_amount * total_usdi_supply) / MAX_wUSDI_SUPPLY;
  }
}
