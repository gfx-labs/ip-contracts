// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../vault/VaultBPT.sol";
import "../controller/VotingVaultController.sol";
import "../controller/NftVaultController.sol";

import "../IVaultController.sol";
import "../IVault.sol";
import "../controller/V3PositionValuator.sol";

import "../../_external/uniswap/INonfungiblePositionManager.sol";

import "../../_external/openzeppelin/ERC20Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";
import "../../_external/extensions/ArrayMutation.sol";


/// @title Univ3CollateralToken
/// @notice creates a token worth 1e18 with 18 visible decimals for vaults to consume
/// @dev extends ierc20 upgradable
contract Univ3CollateralToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  INonfungiblePositionManager public _underlying;
  IVaultController public _vaultController;
  NftVaultController public _nftVaultController;
  V3PositionValuator public _positionValuator;

  ///@notice maps an array of position IDs to their owner
  mapping(address => uint256[]) public _underlyingOwners;

  bool private locked;
  modifier nonReentrant() {
    require(locked == false, "Reentrancy");
    locked = true;
    _;
    locked = false;
  }

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ the address of underlying - NonFungiblePositionManager
  /// @param vaultController_ the address of vault controller
  /// @param nftVaultController_ the address of voting vault controller
  function initialize(
    string memory name_,
    string memory symbol_,
    address underlying_,
    address vaultController_,
    address nftVaultController_,
    address positionValuator_
  ) public initializer {
    __Ownable_init();
    __ERC20_init(name_, symbol_);


    _underlying = INonfungiblePositionManager(underlying_);
    _positionValuator = V3PositionValuator(positionValuator_);
    _vaultController = IVaultController(vaultController_);
    _nftVaultController = NftVaultController(nftVaultController_);
    locked = false;
  }

  /// note Safe transfer not used - better to not allow transfer of erc721 and force to use deposit function so we can add_to_list
  /// @notice deposit _underlying to mint CappedToken
  /// @param tokenId //amount of underlying to deposit
  /// @param vaultId receives the value from the position
  function deposit(uint256 tokenId, uint96 vaultId) public nonReentrant {
    address univ3_vault_address = _nftVaultController.NftVaultAddress(vaultId);
    require(address(univ3_vault_address) != address(0x0), "invalid nft vault");

    ///@notice only allow deposits from registered pools
    _positionValuator.verifyPool(tokenId);

    IVault vault = IVault(_vaultController.vaultAddress(vaultId));
    add_to_list(vault.minter(), tokenId);

    _underlying.transferFrom(_msgSender(), univ3_vault_address, tokenId);
  }

  ///NOTE partial withdrawal not allowed, all positions are transferred to recipient
  ///@param recipient should already be the vault minter from the standard vault (v1)
  ///@notice msgSender should be the parent standard vault
  function transfer(address recipient, uint256 positionIndex) public override returns (bool) {
    IVault vault = IVault(_msgSender());
    require(vault.id() > 0, "Only Vaults");
    address minter = vault.minter();

    address univ3_vault_address = _nftVaultController.NftVaultAddress(vault.id());
    require(univ3_vault_address != address(0x0), "no VaultNft");

    //partial withdrawal
    if (positionIndex < _underlyingOwners[minter].length) {
      uint256 positionId = _underlyingOwners[minter][positionIndex];
      _nftVaultController.retrieveUnderlying(positionId, univ3_vault_address, recipient);
      remove_from_list(minter, positionId);
      return true;
    }

    // if we reach this line, we are withdrawing every position in the list
    // move every nft from the nft vault to the target
    for (uint256 i = 0; i < _underlyingOwners[minter].length; i++) {
      uint256 tokenId = _underlyingOwners[minter][i];
      if (tokenId != 0) {
        // no need to do the check here when removing from list
        _nftVaultController.retrieveUnderlying(tokenId, univ3_vault_address, recipient);
      }
    }
    resetList(minter);
    return true;
  }

  function transferFrom(
    address /*sender*/,
    address /*vaultMinter*/,
    uint256 /*amount*/
  ) public view override returns (bool) /**no bool return for erc721 returns (bool) */ {
    // allowances are never granted, as the VotingVault does not grant allowances.
    // this function is therefore always uncallable and so we will just return false
    //return false; //no return for 721
  }

  ///@notice need to pass an address to match the interface
  ///@param vault should be the standard vault address
  ///@notice we derive the minter of this vault and that is the vaultMinter that the asset is tied to
  function balanceOf(address vault) public view override returns (uint256) {
    IVault V = IVault(vault);
    require(V.id() > 0, "Univ3CollateralToken: OnlyVaults");

    address account = V.minter();
    uint256 totalValue = 0;
    for (uint256 i; i < _underlyingOwners[account].length; i++) {
      totalValue = totalValue + get_token_value(_underlyingOwners[account][i]);
    }
    return totalValue;
  }

  function depositedPositions(address minter) public view returns (uint256[] memory) {
    return _underlyingOwners[minter];
  }

  ///@notice @param tokenId should be a positionId for a registered pool
  function get_token_value(uint256 tokenId) internal view returns (uint256 value) {
    if (tokenId == 0) {
      return 0;
    }
    value = _positionValuator.getValue(tokenId);
  }

  // Utility functions for mutating the address tokenId list
  /// @param vaultMinter should be the vault minter
  function add_to_list(address vaultMinter, uint256 tokenId) internal {
    require(tokenId != 0, "invalid tokenId");
    _underlyingOwners[vaultMinter].push(tokenId);
  }

  ///@notice partial withdrawal not allowed, upon transfer, reset list to new blank list
  ///@param vaultMinter is the owner of the vault
  function resetList(address vaultMinter) internal returns (bool) {
    _underlyingOwners[vaultMinter] = new uint256[](0);
    return true;
  }

  //possible partial withdrawal / liquidation logic
  function remove_from_list(address vaultMinter, uint256 tokenId) internal returns (bool) {
    for (uint256 i; i < _underlyingOwners[vaultMinter].length; i++) {
      if (_underlyingOwners[vaultMinter][i] == tokenId) {
        _underlyingOwners[vaultMinter] = ArrayMutation.removeFromArray(i, _underlyingOwners[vaultMinter]);
      }
    }
    return false;
  }
}
