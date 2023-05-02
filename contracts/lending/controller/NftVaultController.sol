// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IVaultController.sol";

import "../vault/VaultNft.sol";
//import "../vault/VaultBPT.sol";

import "../../_external/IERC20Metadata.sol";
import "../../_external/openzeppelin/ERC20Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";

/// @title CappedGovToken
/// @notice handles all minting/burning of underlying
/// @dev extends ierc20 upgradable
contract NftVaultController is Initializable, OwnableUpgradeable {
  //this is unused but needs to stay or the storage will be off by 8 bits for future upgrades
  uint8 private _underlying_decimals;
  IVaultController public _vaultController;

  mapping(address => uint96) public _vaultAddress_vaultId; //standard vault addr
  mapping(uint96 => address) public _vaultId_nftVaultAddress;
  mapping(address => uint96) public _nftVaultAddress_vaultId;

  mapping(address => address) public _underlying_CollateralToken;
  mapping(address => address) public _CollateralToken_underlying;

  event NewNftVault(address nft_vault_address, uint256 vaultId);

  /// @notice initializer for contract
  /// @param vaultController_ the address of the vault controller
  function initialize(address vaultController_) public initializer {
    __Ownable_init();
    _vaultController = IVaultController(vaultController_);
  }
  /// @notice register an underlying nft token pair
  /// note that registring a token as a nft token allows it to transfer the balance of the corresponding token at will
  /// @param underlying_address address of underlying
  /// @param capped_token address of nft wrapper token
  function registerUnderlying(address underlying_address, address capped_token) external onlyOwner {
    _underlying_CollateralToken[underlying_address] = capped_token;
    _CollateralToken_underlying[capped_token] = underlying_address;
  }

  /// @notice retrieve underlying asset for the cap token
  /// @param tokenId of underlying asset to retrieve
  /// @param nft_vault holding the underlying
  /// @param target to receive the underlying
  function retrieveUnderlying(uint256 tokenId, address nft_vault, address target) public {
    require(nft_vault != address(0x0), "invalid vault");
    address underlying_address = _CollateralToken_underlying[_msgSender()];
    require(underlying_address != address(0x0), "only capped token");
    VaultNft nftVault = VaultNft(nft_vault);
    nftVault.nftVaultControllerTransfer(underlying_address, target, tokenId);
  }

  /// @notice create a new vault
  /// @param id of an existing vault
  /// @return address of the new vault
  function mintVault(uint96 id) public returns (address) {
    if (_vaultId_nftVaultAddress[id] == address(0)) {
      address vault_address = _vaultController.vaultAddress(id);
      if (vault_address != address(0)) {
        // mint the vault itself, deploying the contract
        address nft_vault_address = address(
          new VaultNft(id, vault_address, address(_vaultController), address(this))
        );
        // add the vault to our system
        _vaultId_nftVaultAddress[id] = nft_vault_address;
        _vaultAddress_vaultId[vault_address] = id;
        _nftVaultAddress_vaultId[nft_vault_address] = id;
        // emit the event
        emit NewNftVault(nft_vault_address, id);
      }
    }
    return _vaultId_nftVaultAddress[id];
  }

  function NftVaultId(address nft_vault_address) public view returns (uint96) {
    return _nftVaultAddress_vaultId[nft_vault_address];
  }

  function vaultId(address vault_address) public view returns (uint96) {
    return _vaultAddress_vaultId[vault_address];
  }

  function NftVaultAddress(uint96 vault_id) public view returns (address) {
    return _vaultId_nftVaultAddress[vault_id];
  }
}
