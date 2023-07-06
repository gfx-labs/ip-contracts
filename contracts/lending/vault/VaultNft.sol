// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../controller/NftVaultController.sol";

import "../../IUSDI.sol";
import "../IVault.sol";
import "../IVaultController.sol";

import "../../_external/CompLike.sol";
import "../../_external/IERC721.sol";
import "../../_external/Context.sol";
import "../../_external/uniswap/INonfungiblePositionManager.sol";
import "../../_external/openzeppelin/ERC721Upgradeable.sol";
import "../../_external/balancer/IGauge.sol";

contract VaultNft is Context {
  //using SafeERC721Upgradeable for IERC721;

  /// @title VaultInfo struct
  /// @notice This vault holds the underlying token
  /// @notice The Capped token is held by the parent vault
  /// @notice Withdrawls must be initiated by the withdrawErc20() function on the parent vault

  /// @notice this struct is used to store the vault metadata
  /// this should reduce the cost of minting by ~15,000
  /// by limiting us to max 2**96-1 vaults
  struct VaultInfo {
    uint96 id;
    address vault_address;
  }
  /// @notice Metadata of vault, aka the id & the minter's address
  VaultInfo public _vaultInfo;

  NftVaultController public _nftController;
  IVaultController public _controller;

  /// @notice checks if _msgSender is the controller of the nft vault
  modifier onlyNftVaultController() {
    require(_msgSender() == address(_nftController), "sender not NftVaultController");
    _;
  }
  /// @notice checks if _msgSender is the controller of the vault
  modifier onlyVaultController() {
    require(_msgSender() == address(_controller), "sender not VaultController");
    _;
  }
  /// @notice checks if _msgSender is the minter of the vault
  modifier onlyMinter() {
    require(_msgSender() == IVault(_vaultInfo.vault_address).minter(), "sender not minter");
    _;
  }

  /// @notice must be called by NftVaultController, else it will not be registered as a vault in system
  /// @param id_ is the shared ID of both the nft vault and the standard vault
  /// @param vault_address address of the vault this is attached to
  /// @param controller_address address of the vault controller
  /// @param nft_controller_address address of the nft vault controller
  constructor(
    uint96 id_,
    address vault_address,
    address controller_address,
    address nft_controller_address //address _auraBal
  ) {
    _vaultInfo = VaultInfo(id_, vault_address);
    _controller = IVaultController(controller_address);
    _nftController = NftVaultController(nft_controller_address);
  }

  ///@notice @return vault address for v1 vault
  function parentVault() external view returns (address vault) {
    vault = address(_vaultInfo.vault_address);
  }

  /// @notice id of the vault
  /// @return address of minter
  function id() external view returns (uint96) {
    return _vaultInfo.id;
  }

  ///@notice collect revenue from the position
  ///@param tokenId for the position
  ///@param recipient to recieve the revenue
  function collect(uint256 tokenId, address recipient) external onlyMinter {
    INonfungiblePositionManager positionManager = INonfungiblePositionManager(_nftController._nfpManager());

    positionManager.collect(
      INonfungiblePositionManager.CollectParams({
        tokenId: tokenId,
        recipient: recipient,
        amount0Max: 2 ** 128 - 1,
        amount1Max: 2 ** 128 - 1
      })
    );
  }

  /// not currently in use, available for future upgrades
  /// @param _token token to transfer
  /// @param _to person to send the nft to
  /// @param _tokenId tokenId of nft to move
  function controllerTransfer(address _token, address _to, uint256 _tokenId) external onlyVaultController {
    //SafeERC721Upgradeable.safeTransfer(IERC721Upgradeable(_token, _to, _tokenId);
    IERC721(_token).transferFrom(address(this), _to, _tokenId);
  }

  /// @notice function used by the NftVaultController to transfer tokens
  /// callable by the NftVaultController only
  /// @param _token token to transfer
  /// @param _to person to send the nft to
  /// @param _tokenId tokenId of nft to move
  function nftVaultControllerTransfer(address _token, address _to, uint256 _tokenId) external onlyNftVaultController {
    //SafeERC721Upgradeable.safeTransfer(IERC721Upgradeable(_token, _to, _tokenId);
    IERC721(_token).transferFrom(address(this), _to, _tokenId);
  }
}
