// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../vault/VaultBPT.sol";
import "../controller/VotingVaultController.sol";
import "../controller/NftVaultController.sol";

import "../IVaultController.sol";
import "../IVault.sol";
import "../../oracle/IOracleMaster.sol";
import "../../oracle/External/V3PositionValuator.sol";

//import "../../_external/IERC721Metadata.sol";
import "../../_external/uniswap/INonfungiblePositionManager.sol";

import "../../_external/openzeppelin/ERC20Upgradeable.sol";
import "../../_external/openzeppelin/ERC721Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";

//import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "hardhat/console.sol";

//not sure this is a thing
//import "../../_external/openzeppelin/SafeERC721Upgradeable.sol";

/**
  generic todo
  withdraw event on standard vault will have incorrect amount

 */

/// @title Univ3CollateralToken
/// @notice creates a token worth 1e18 with 18 visible decimals for vaults to consume
/// @dev extends ierc20 upgradable
contract Univ3CollateralToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  //using SafeERC721Upgradeable for ERC721Upgradeable;
  IOracleMaster public oracle;

  INonfungiblePositionManager public _underlying;
  IVaultController public _vaultController;
  NftVaultController public _nftVaultController;
  V3PositionValuator public _positionValuator;

  mapping(address => uint256[]) public _underlyingOwners;

  bool private locked;

  modifier nonReentrant() {
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
    //__ERC721_init(name_, symbol_);
    __ERC20_init(name_, symbol_);

    _underlying = INonfungiblePositionManager(underlying_);
    _positionValuator = V3PositionValuator(positionValuator_);
    _vaultController = IVaultController(vaultController_);
    _nftVaultController = NftVaultController(nftVaultController_);
    updateOracle();
    locked = false;
  }

  ///todo
  function updateOracle() public {
    oracle = IOracleMaster(_vaultController.getOracleMaster());
  }

  /// @notice 18 decimal erc20 spec should have been written into the fucking standard
  function decimals() public pure override returns (/**override */ uint8) {
    return 18;
  }

  /// todo use safe transfer from? Might not be needed as there is dedicated deposit function
  /// todo maybe better to not allow transfer of erc721 and force to use deposit function so we can add_to_list
  /// @notice deposit _underlying to mint CappedToken
  /// @param tokenId //amount of underlying to deposit
  /// @param vaultId receives the value from the position
  function deposit(uint256 tokenId, uint96 vaultId) public nonReentrant {
    address univ3_vault_address = _nftVaultController.NftVaultAddress(vaultId);
    require(address(univ3_vault_address) != address(0x0), "invalid voting vault");

    ///@notice only allow deposits from registered pools
    (bool registered, , ) = _positionValuator.verifyPool(tokenId);
    require(registered, "Pool not registered");

    IVault vault = IVault(_vaultController.vaultAddress(vaultId));
    add_to_list(vault.minter(), tokenId);
    //todo total supply?
    //todo emit mint event?

    _underlying.transferFrom(_msgSender(), univ3_vault_address, tokenId);
  }

  // transfer withdraws every single NFT from the vault.
  // TODO: this means no partial liquidations/withdraws. We could possibly support partial withdraws -
  // but it would mean changing our liquidation logic even more. Let's think about this.
  // basically we can code the token id into the amount, but we would need to make sure that
  // liquidations always move an amount that is not a tokenId to ensure no exploit is possible.
  /**
    underlying owner is associated with the vault (v1) addr so we need to derive that from the vaultMinter
   */
  ///@param recipient should already be the vault minter from the standard vault (v1)
  ///@notice msgSender should be the parent standard vault
  function transfer(address recipient, uint256 /**amount */) public override returns (bool) {
    IVault vault = IVault(_msgSender());
    require(vault.id() > 0, "Only Vaults");
    address minter = vault.minter();

    address univ3_vault_address = _nftVaultController.NftVaultAddress(vault.id());
    require(univ3_vault_address != address(0x0), "no univ3 vault");

    console.log("Transfer length: ", _underlyingOwners[minter].length);

    // move every nft from the nft vault to the target
    for (uint256 i = 0; i < _underlyingOwners[minter].length; i++) {
      uint256 tokenId = _underlyingOwners[minter][i];
      console.log("Transfer tokenId: ", tokenId);
      //todo figure out why there is a 0 id in the list
      if (tokenId != 0) {
        // no need to do the check here when removing from list
        remove_from_list(minter, tokenId);
        _nftVaultController.retrieveUnderlying(tokenId, univ3_vault_address, recipient);
      }
    }
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

  // TODO: will solidity be smart enough to gas optimize for us here? if not, we need to make sure this function is as cheap as we can get it

  ///@notice need to pass an address to match the interface
  ///@param vault should be the standard vault address (?)
  ///@notice we derive the minter of this vault and that is the vaultMinter that the asset is tied to
  function balanceOf(address vault) public view override returns (uint256) {
    IVault V = IVault(vault);
    require(V.id() > 0, "Univ3CollateralToken: OnlyVaults");

    //get minter
    address account = V.minter();
    // iterate across each user balance
    uint256 totalValue = 0;
    for (uint256 i; i < _underlyingOwners[account].length; i++) {
      //TODO: investigate possible gas improvement through passing multiple tokenIds  instead of doing them one by one
      // this would allow us to cache values from historical calculations, but im not sure if that would even save anything
      totalValue = totalValue + get_token_value(_underlyingOwners[account][i]);
    }
    return totalValue;
  }

  function get_token_value(uint256 tokenId) internal view returns (uint256 value) {
    if (tokenId == 0) {
      return 0;
    }
    value = _positionValuator.getValue(tokenId);
  }

  ///todo  need to mint actual tokens such that the total supply increases here
  // Utility functions for mutating the address tokenId list
  /// @param vaultMinter should be the vault minter
  function add_to_list(address vaultMinter, uint256 tokenId) internal {
    _underlyingOwners[vaultMinter].push(tokenId);
  }

  /// @param vaultMinter should be the vault minter
  function remove_from_list(address vaultMinter, uint256 tokenId) internal returns (bool) {
    for (uint256 i; i < _underlyingOwners[vaultMinter].length; i++) {
      if (_underlyingOwners[vaultMinter][i] == tokenId) {
        _underlyingOwners[vaultMinter][i] = 0;
        return true;
      }
    }
  }
}
