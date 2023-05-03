// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../vault/VaultBPT.sol";
import "../controller/VotingVaultController.sol";
import "../controller/NftVaultController.sol";

import "../IVaultController.sol";
import "../IVault.sol";

//import "../../_external/IERC721Metadata.sol";
import "../../_external/uniswap/INonfungiblePositionManager.sol";
import "../../_external/openzeppelin/ERC721Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";

//not sure this is a thing
//import "../../_external/openzeppelin/SafeERC721Upgradeable.sol";

/// @title Univ3CollateralToken
/// @notice creates a token worth 1e18 with 18 visible decimals for vaults to consume
/// @dev extends ierc20 upgradable
contract Univ3CollateralToken is Initializable, OwnableUpgradeable, ERC721Upgradeable {
  //using SafeERC721Upgradeable for ERC721Upgradeable;

  ERC721Upgradeable public _underlying;
  IVaultController public _vaultController;
  NftVaultController public _nftVaultController;

  INonfungiblePositionManager public _univ3NftPositions;

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
  /// @param underlying_ the address of underlying
  /// @param vaultController_ the address of vault controller
  /// @param nftVaultController_ the address of voting vault controller
  function initialize(
    string memory name_,
    string memory symbol_,
    address underlying_,
    address vaultController_,
    address nftVaultController_,
    address univ3NftPositions_
  ) public initializer {
    __Ownable_init();
    __ERC721_init(name_, symbol_);
    _underlying = ERC721Upgradeable(underlying_);

    _vaultController = IVaultController(vaultController_);
    _nftVaultController = NftVaultController(nftVaultController_);
    _univ3NftPositions = INonfungiblePositionManager(univ3NftPositions_);

    locked = false;
  }

  /// @notice 18 decimal erc20 spec should have been written into the fucking standard
  function decimals() public pure /**override */ returns (uint8) {
    return 18;
  }

  /// @notice deposit _underlying to mint CappedToken
  /// @notice gaugeToken is fungible 1:1 with underlying BPT
  /// @param tokenId //amount of underlying to deposit
  /// @param vaultId recipient vault of tokens
  /// @param stake deposit + stake in 1 TX, for auraBal or aura LPs
  function deposit(uint256 tokenId, uint96 vaultId, bool stake) public nonReentrant {
    address univ3_vault_address = _nftVaultController.NftVaultAddress(vaultId);
    require(address(univ3_vault_address) != address(0x0), "invalid voting vault");

    // transfer position
    // todo
    //_underlying.safeTransferFrom(_msgSender(), address(univ3_vault_address), amount);
  }

  // transfer withdraws every single NFT from the vault.
  // TODO: thie means no partial liquidations/withdraws. We could possibly support partial withdraws -
  // but it would mean changing our liquidation logic even more. Let's think about this.
  // basically we can code the token id into the amount, but we would need to make sure that
  // liquidations always move an amount that is not a tokenId to ensure no exploit is possible.
  function transfer(address recipient, uint256 amount) public /**override */ returns (bool) {
    uint96 vault_id = _nftVaultController.vaultId(_msgSender());
    // only vaults will ever send this. only vaults will ever need to call this function
    require(vault_id > 0, "only vaults");
    // get the corresponding voting vault
    address univ3_vault_address = _nftVaultController.NftVaultAddress(vault_id);
    require(univ3_vault_address != address(0x0), "no univ3 vault");

    // move every nft from the nft vault to the target
    for (uint256 i; i < _underlyingOwners[recipient].length; i++) {
      uint256 tokenId = _underlyingOwners[recipient][i];
      // no need to do the check here when removing from list
      remove_from_list(univ3_vault_address, tokenId);
      _nftVaultController.retrieveUnderlying(tokenId, univ3_vault_address, recipient);
    }
    return true;
  }

  function transferFrom(
    address /*sender*/,
    address /*recipient*/,
    uint256 /*amount*/
  ) public pure override /**no bool return for erc721 returns (bool) */ {
    // allowances are never granted, as the VotingVault does not grant allowances.
    // this function is therefore always uncallable and so we will just return false
    //return false; //no return for 721
  }

  // TODO: will solidity be smart enough to gas optimize for us here? if not, we need to make sure this function is as cheap as we can get it
  function balanceOf(address account) public view override returns (uint256) {
    // iterate across each user balance
    uint256 totalValue = 0;
    for (uint256 i; i < _underlyingOwners[account].length; i++) {
      //TODO: investigate possible gas improvement through passing multiple tokenids  instead of doing them one by one
      // this would allow us to cache values from historical calculations, but im not sure if that would even save anything
      totalValue = totalValue + get_token_value(_underlyingOwners[account][i]);
    }
    return totalValue;
  }

  function get_token_value(uint256 tokenid) internal view returns (uint256) {
    try _univ3NftPositions.positions(tokenid) returns (
      uint96 nonce,
      address operator,
      address token0,
      address token1,
      uint24 fee,
      int24 tickLower,
      int24 tickUpper,
      uint128 liquidity,
      uint256 feeGrowthInside0LastX128,
      uint256 feeGrowthInside1LastX128,
      uint128 tokensOwed0,
      uint128 tokensOwed1
    ) {
      // TODO: use token0 and token1 with the oraclemaster, along with their tokensOwed to calculate their collateral value
    } catch (bytes memory /*lowLevelData*/) {
      // return 0 if the position has somehow become invalid
      return 0;
    }
  }

  // Utility functions for mutating the address tokenid list
  function add_to_list(address recipient, uint256 tokenid) internal {
    for (uint256 i; i < _underlyingOwners[recipient].length; i++) {
      // replace 0 first
      if (_underlyingOwners[recipient][i] == 0) {
        _underlyingOwners[recipient][i] = tokenid;
        return;
      }
      _underlyingOwners[recipient][i] = (tokenid);
    }
  }

  function remove_from_list(address recipient, uint256 tokenid) internal returns (bool) {
    for (uint256 i; i < _underlyingOwners[recipient].length; i++) {
      if (_underlyingOwners[recipient][i] == tokenid) {
        _underlyingOwners[recipient][i] = 0;
        return true;
      }
    }
    return false;
  }
}
