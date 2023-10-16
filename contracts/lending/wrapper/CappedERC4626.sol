// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../vault/VotingVault.sol";
import "../controller/VotingVaultController.sol";

import "../IVaultController.sol";
import "../IVault.sol";

import "../../_external/IERC20Metadata.sol";
import "../../_external/openzeppelin/ERC20Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";
import "../../_external/openzeppelin/SafeERC20Upgradeable.sol";
import "../../_external/openzeppelin/ReentrancyGuardUpgradeable.sol";

interface IERC4626 {
  // deposits assets of underlying tokens into the vault and grants ownership of shares to receiver
  function deposit(uint256 assets, address receiver) external returns (uint256 shares);

  // redeems a specific number of shares from owner and sends assets of underlying token to receiver
  function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
}

/// @title CappedERC4626
/// @notice Read more about ERC-4626 - https://eips.ethereum.org/EIPS/eip-4626
/// @notice Wraps rebasing ERC4626 before being sending the wrapped asset to the IP vault
/// @notice Deposits can be either the base or the wrapped asset
/// @notice Withdrawals are ALWAYS the base asset (rebasing)
/// @dev _underlying should be the wrapped shares, whcih appreciates in price
/// @dev _baseUnderlying should be the base asset, which appreciates in balance
/// @dev logic is otherwise the same as CappedGovToken
/// @dev extends ierc20 upgradable
contract CappedERC4626 is Initializable, OwnableUpgradeable, ERC20Upgradeable, ReentrancyGuardUpgradeable {
  using SafeERC20Upgradeable for ERC20Upgradeable;

  //should be the wrapped asset
  ERC20Upgradeable public _underlying;

  //should be the rebasing base asset
  ERC20Upgradeable public _baseUnderlying;

  IVaultController public _vaultController;
  VotingVaultController public _votingVaultController;

  ///@notice _cap is denoted in _underlying NOT _baseUnderlying
  uint256 public _cap;

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ should be the wrapped asset that appreciates in price
  /// @param baseUnderlying_ should be the rebasing base asset that appreciates in balance
  /// @param vaultController_ the address of vault controller
  /// @param votingVaultController_ the address of voting vault controller
  function initialize(
    string memory name_,
    string memory symbol_,
    address underlying_,
    address baseUnderlying_,
    address vaultController_,
    address votingVaultController_
  ) public initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    __ERC20_init(name_, symbol_);
    _underlying = ERC20Upgradeable(underlying_);
    _baseUnderlying = ERC20Upgradeable(baseUnderlying_);
    _vaultController = IVaultController(vaultController_);
    _votingVaultController = VotingVaultController(votingVaultController_);
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
  /// @param amount of underlying to deposit
  /// @param vaultId recipient vault of tokens
  /// @param depositBase is true if depositing the rebasing base asset
  function deposit(uint256 amount, uint96 vaultId, bool depositBase) public nonReentrant {
    require(amount > 0, "Cannot deposit 0");
    VotingVault votingVault = VotingVault(_votingVaultController.votingVaultAddress(vaultId));
    require(address(votingVault) != address(0x0), "invalid voting vault");
    IVault vault = IVault(_vaultController.vaultAddress(vaultId));
    require(address(vault) != address(0x0), "invalid vault");

    //if deposit base (base rebasing token)
    //then we wrap and get new amount
    //else we are depositing the wrapped token (appreciates in price rather than balance)
    //so we just transfer normally
    if (depositBase) {
      amount = depositAndWrap(amount, address(votingVault));
    } else {
      // send the actual underlying to the voting vault for the vault
      _underlying.safeTransferFrom(_msgSender(), address(votingVault), amount);
    }

    // check cap
    checkCap(amount);

    // mint this token, the collateral token, to the vault
    ERC20Upgradeable._mint(address(vault), amount);
  }

  function depositAndWrap(uint256 amount, address votingVault) internal returns (uint256) {
    _baseUnderlying.safeTransferFrom(_msgSender(), address(this), amount);
    _baseUnderlying.approve(address(_underlying), amount);
    return IERC4626(address(_underlying)).deposit(amount, votingVault);
  }

  function transfer(address recipient, uint256 amount) public override returns (bool) {
    uint96 vault_id = _votingVaultController.vaultId(_msgSender());
    // only vaults will ever send this. only vaults will ever hold this token.
    require(vault_id > 0, "only vaults");
    // get the corresponding voting vault
    address voting_vault_address = _votingVaultController.votingVaultAddress(vault_id);
    require(voting_vault_address != address(0x0), "no voting vault");
    // burn the collateral tokens from the sender, which is the vault that holds the collateral tokens
    ERC20Upgradeable._burn(_msgSender(), amount);
    // move the underlying tokens from voting vault to the this contract so we can then unwrap
    _votingVaultController.retrieveUnderlying(amount, voting_vault_address, address(this));
    return unwrap(amount, recipient);
  }

  ///@notice unwraps to the rebasing base asset
  ///@param shares is shares of the wrapped asset (_underlying)
  function unwrap(uint256 shares, address recipient) internal returns (bool) {
    IERC4626(address(_underlying)).redeem(shares, recipient, address(this));
    return true;
  }

  function transferFrom(
    address /*sender*/,
    address /*recipient*/,
    uint256 /*amount*/
  ) public pure override returns (bool) {
    // allowances are never granted, as the VotingVault does not grant allowances.
    // this function is therefore always uncallable and so we will just return false
    return false;
  }
}
