// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../_external/IERC20Metadata.sol";
import "../_external/openzeppelin/ERC20Upgradeable.sol";
import "../_external/openzeppelin/OwnableUpgradeable.sol";
import "../_external/openzeppelin/Initializable.sol";
import "../_external/openzeppelin/SafeERC20Upgradeable.sol";

import "./IVaultController.sol";
import "./IVault.sol";

import "hardhat/console.sol";

/// @title CappedFeeOnTransferToken
/// @notice handles all minting/burning of underlying
/// @dev extends ierc20 upgradable
contract CappedFeeOnTransferToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  IERC20Metadata public _underlying;
  IVaultController public _vaultController;

  uint8 private _underlying_decimals;

  /// @notice CAP is in units of the CAP token,so 18 decimals.
  ///         not the underlying!!!!!!!!!
  uint256 public _cap;

  /// @notice need to prevent reentrancy on deposit as calcs are done after transfer
  bool internal locked;
  modifier nonReentrant() {
    require(!locked, "locked");
    locked = true;
    _;
    locked = false;
  }

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ the address of underlying
  function initialize(
    string memory name_,
    string memory symbol_,
    address underlying_,
    address vaultController_
  ) public initializer {
    __Ownable_init();
    __ERC20_init(name_, symbol_);
    _underlying = IERC20Metadata(underlying_);
    _underlying_decimals = _underlying.decimals();

    _vaultController = IVaultController(vaultController_);

    locked = false;
  }

  /// @notice 18 decimal erc20 spec should have been written into the fucking standard
  function decimals() public pure override returns (uint8) {
    return 18;
  }

  /// @notice get the Cap
  /// @return cap uint256
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

  /// @notice deposit _underlying to mint CappedToken
  /// @notice nonReentrant modifier needed as calculations are done after transfer
  /// @param amount of underlying to deposit
  /// @param vaultId recipient vault of tokens
  function deposit(uint256 amount, uint96 vaultId) public nonReentrant {
    // check how many underlying tokens we have before transfer
    uint256 startingUnderlying = _underlying.balanceOf(address(this));

    // scale the decimals to THIS token decimals, or 1e18. see underlyingToCappedAmount
    require(amount > 0, "Cannot deposit 0");

    IVault vault = IVault(_vaultController.vaultAddress(vaultId));
    require(address(vault) != address(0x0), "invalid vault");

    // check allowance and ensure transfer success
    uint256 allowance = _underlying.allowance(_msgSender(), address(this));
    require(allowance >= amount, "Insufficient Allowance");

    // transfer underlying from SENDER to THIS
    require(_underlying.transferFrom(_msgSender(), address(this), amount), "transfer failed");

    // determine exact amount received to account for fee-on-transfer
    uint256 amountReceived = _underlying.balanceOf(address(this)) - startingUnderlying;

    // check cap against amountReceived
    checkCap(amountReceived);

    // mint the scaled amount of tokens to the TARGET
    ERC20Upgradeable._mint(address(vault), amountReceived);
  }

  /**
  /// @notice withdraw underlying by burning THIS token
  /// caller should obtain 1 underlying for every underlyingScalar() THIS token
  /// @param underlying_amount amount of underlying to withdraw
  function withdraw(uint256 underlying_amount, address target) public {
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

  /**
      DEPOSIT - called publicly
      PAXG stays here, cappedG goes to regular vault
      need to get vault from user's 

      WITHDRAW - called only by vault as a result of calling withdraw on vault
      call withdraw on vault
      this calls safeTransfer on cappedG, calling transfer on cappedG

      we need to burn cappedG received from the vault
      then transfer paxg on its merry way
     */
  function transfer(address recipient, uint256 amount) public override returns (bool) {
    IVault vault = IVault(_msgSender());
    require(_vaultController.vaultAddress(vault.id()) != address(0x0), "Only vault");

    //burn
    ERC20Upgradeable._burn(_msgSender(), amount);

    //retrieveUnderlying
    SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(address(_underlying)), recipient, amount);

    return true;
  }

  function transferFrom(
    address, /*sender*/
    address, /*recipient*/
    uint256 /*amount*/
  ) public pure override returns (bool) {
    // allowances are never granted, as the VotingVault does not grant allowances.
    // this function is therefore always uncallable and so we will just return false
    return false;
  }
}
