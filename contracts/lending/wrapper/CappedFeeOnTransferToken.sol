// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../vault/VotingVault.sol";
import "../controller/VotingVaultController.sol";
import "../IVaultController.sol";
import "../IVault.sol";

import "../../_external/IERC20Metadata.sol";
import "../../_external/openzeppelin/ERC20Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";
import "../../_external/openzeppelin/SafeERC20Upgradeable.sol";

/// @title CappedFeeOnTransferToken
/// @notice handles all minting/burning of underlying
/// @dev extends ierc20 upgradable
contract CappedFeeOnTransferToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  using SafeERC20Upgradeable for ERC20Upgradeable;

  ERC20Upgradeable public _underlying;
  IVaultController public _vaultController;
  VotingVaultController public _votingVaultController;

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
    address vaultController_,
    address votingVaultController_
  ) public initializer {
    __Ownable_init();
    __ERC20_init(name_, symbol_);
    _underlying = ERC20Upgradeable(underlying_);

    _vaultController = IVaultController(vaultController_);
    _votingVaultController = VotingVaultController(votingVaultController_);

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

  function checkCap() internal view {
    require(ERC20Upgradeable.totalSupply() <= _cap, "cap reached");
  }

  /// @notice deposit _underlying to mint CappedToken
  /// @notice nonReentrant modifier needed as calculations are done after transfer
  /// @param amount of underlying to deposit
  /// @param vaultId recipient vault of tokens
  function deposit(uint256 amount, uint96 vaultId) public nonReentrant {
    require(amount > 0, "Cannot deposit 0");

    //gather vault information
    VotingVault votingVault = VotingVault(_votingVaultController.votingVaultAddress(vaultId));
    require(address(votingVault) != address(0x0), "invalid voting vault");
    IVault vault = IVault(_vaultController.vaultAddress(vaultId));
    require(address(vault) != address(0x0), "invalid vault");

    // check allowance and ensure transfer success
    uint256 allowance = _underlying.allowance(_msgSender(), address(this));
    require(allowance >= amount, "Insufficient Allowance");

    uint256 startingUnderlying = _underlying.balanceOf(address(votingVault));

    // send the actual underlying from the caller to the voting vault for the vault
    _underlying.safeTransferFrom(_msgSender(), address(votingVault), amount);

    //verify the actual amount received
    uint256 amountReceived = _underlying.balanceOf(address(votingVault)) - startingUnderlying;

    //mint amountReceived new capTokens to the vault
    ERC20Upgradeable._mint(address(vault), amountReceived);

    // check cap to make sure we didn't exceed it
    checkCap();
  }

  function transfer(address recipient, uint256 amount) public override returns (bool) {
    uint96 vault_id = _votingVaultController.vaultId(_msgSender());

    // only vaults should call this. only vaults will ever hold this token.
    require(vault_id > 0, "only vaults");

    // get the corresponding voting vault
    address voting_vault_address = _votingVaultController.votingVaultAddress(vault_id);

    require(voting_vault_address != address(0x0), "no voting vault");

    // burn the collateral tokens from the sender, which is the vault that holds the collateral tokens
    ERC20Upgradeable._burn(_msgSender(), amount);

    // move the underlying tokens from voting vault to the target
    _votingVaultController.retrieveUnderlying(amount, voting_vault_address, recipient);

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
