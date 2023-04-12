// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../_external/IERC20Metadata.sol";
import "../../_external/openzeppelin/ERC20Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";
import "../../_external/IERC20Metadata.sol";

import {SafeERC20} from "../../_external/extensions/SafeERC20.sol";

interface IStETH is IERC20 {
  function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256);

  function getSharesByPooledEth(uint256 _pooledEthAmount) external view returns (uint256);

  function submit(address _referral) external payable returns (uint256);
}

/**
 * @title StETH token wrapper with static balances.
 * @dev It's an ERC20 token that represents the account's share of the total
 * supply of stETH tokens. WstETH token's balance only changes on transfers,
 * unlike StETH that is also changed when oracles report staking rewards and
 * penalties. It's a "power user" token for DeFi protocols which don't
 * support rebasable tokens.
 *
 * The contract is also a trustless wrapper that accepts stETH tokens and mints
 * wstETH in return. Then the user unwraps, the contract burns user's wstETH
 * and sends user locked stETH in return.
 *
 * The contract provides the staking shortcut: user can send ETH with regular
 * transfer and get wstETH in return. The contract will send ETH to Lido submit
 * method, staking it and wrapping the received stETH.
 *
 */
contract CappedSTETH is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  using SafeERC20 for IERC20;

  IStETH public stETH;

  IERC20Metadata public _underlying;
  uint8 private _underlying_decimals;

  uint256 public _cap;

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ the address of underlying
  function initialize(string memory name_, string memory symbol_, address underlying_) public initializer {
    __Ownable_init();
    __ERC20_init(name_, symbol_);
    _underlying = IERC20Metadata(underlying_);
    _underlying_decimals = _underlying.decimals();

    stETH = IStETH(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);
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

  ///////////////////////// WSTETH FUNCTIONS /////////////////////////

  /**
   * @notice Exchanges stETH to wstETH
   * @param _stETHAmount amount of stETH to wrap in exchange for wstETH
   * @dev Requirements:
   *  - `_stETHAmount` must be non-zero
   *  - msg.sender must approve at least `_stETHAmount` stETH to this
   *    contract.
   *  - msg.sender must have at least `_stETHAmount` of stETH.
   * User should first approve _stETHAmount to the WstETH contract
   * @return Amount of wstETH user receives after wrap
   */
  function wrap(uint256 _stETHAmount) external returns (uint256) {
    checkCap(_stETHAmount);
    require(_stETHAmount > 0, "wstETH: can't wrap zero stETH");
    uint256 wstETHAmount = stETH.getSharesByPooledEth(_stETHAmount);
    _mint(msg.sender, wstETHAmount);
    stETH.transferFrom(msg.sender, address(this), _stETHAmount);
    return wstETHAmount;
  }

  /**
   * @notice Exchanges wstETH to stETH
   * @param _wstETHAmount amount of wstETH to uwrap in exchange for stETH
   * @dev Requirements:
   *  - `_wstETHAmount` must be non-zero
   *  - msg.sender must have at least `_wstETHAmount` wstETH.
   * @return Amount of stETH user receives after unwrap
   */
  function unwrap(uint256 _wstETHAmount) external returns (uint256) {
    require(_wstETHAmount > 0, "wstETH: zero amount unwrap not allowed");
    uint256 stETHAmount = stETH.getPooledEthByShares(_wstETHAmount);
    _burn(msg.sender, _wstETHAmount);
    stETH.transfer(msg.sender, stETHAmount);
    return stETHAmount;
  }

  /**
   * @notice Shortcut to stake ETH and auto-wrap returned stETH
   receive() external payable {
    uint256 shares = stETH.submit{value: msg.value}(address(0));
    _mint(msg.sender, shares);
  }
   */

  /**
   * @notice Get amount of wstETH for a given amount of stETH
   * @param _stETHAmount amount of stETH
   * @return Amount of wstETH for a given stETH amount
   */
  function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256) {
    return stETH.getSharesByPooledEth(_stETHAmount);
  }

  /**
   * @notice Get amount of stETH for a given amount of wstETH
   * @param _wstETHAmount amount of wstETH
   * @return Amount of stETH for a given wstETH amount
   */
  function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256) {
    return stETH.getPooledEthByShares(_wstETHAmount);
  }

  /**
   * @notice Get amount of stETH for a one wstETH
   * @return Amount of stETH for 1 wstETH
   */
  function stEthPerToken() external view returns (uint256) {
    return stETH.getPooledEthByShares(1 ether);
  }

  /**
   * @notice Get amount of wstETH for a one stETH
   * @return Amount of wstETH for a 1 stETH
   */
  function tokensPerStEth() external view returns (uint256) {
    return stETH.getSharesByPooledEth(1 ether);
  }
}
