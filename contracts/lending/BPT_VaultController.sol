// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../_external/IERC20Metadata.sol";
import "../_external/openzeppelin/ERC20Upgradeable.sol";
import "../_external/openzeppelin/OwnableUpgradeable.sol";
import "../_external/openzeppelin/Initializable.sol";

import "./IVaultController.sol";
import "./VotingVault.sol";

//import "./VaultBPT.sol";

//import "hardhat/console.sol";

/// @title CappedGovToken
/// @notice handles all minting/burning of underlying
/// @dev extends ierc20 upgradable
contract BPT_VaultController is Initializable, OwnableUpgradeable {
  IVaultController public _vaultController;

  mapping(address => uint96) public _vaultAddress_vaultId; //standard vault addr
  mapping(uint96 => address) public _vaultId_votingVaultAddress;
  mapping(address => uint96) public _votingVaultAddress_vaultId;

  mapping(address => address) public _underlying_CappedToken;
  mapping(address => address) public _CappedToken_underlying;

  /**
    mapping(uint96 => address) public _vaultId_vaultBPTaddress;
  mapping(address => uint96) public _vaultBPTaddress_vaultId;
   */

  event NewVotingVault(address voting_vault_address, uint256 vaultId);
  event NewVaultBPT(address vault_bpt_address, uint256 vaultId);

  /// @notice initializer for contract
  /// @param vaultController_ the address of the vault controller
  function initialize(address vaultController_) public initializer {
    __Ownable_init();
    _vaultController = IVaultController(vaultController_);
  }

  /// @notice register an underlying capped token pair
  /// note that registring a token as a capepd token allows it to transfer the balance of the corresponding token at will
  /// @param underlying_address address of underlying
  /// @param capped_token address of capped token
  function registerUnderlying(address underlying_address, address capped_token) external onlyOwner {
    _underlying_CappedToken[underlying_address] = capped_token;
    _CappedToken_underlying[capped_token] = underlying_address;
  }

  /// @notice retrieve underlying asset for the cap token
  /// @param amount of underlying asset to retrieve by burning cap tokens
  /// @param voting_vault holding the underlying
  /// @param target to receive the underlying
  function retrieveUnderlying(
    uint256 amount,
    address voting_vault,
    address target
  ) public {
    require(voting_vault != address(0x0), "invalid vault");

    address underlying_address = _CappedToken_underlying[_msgSender()];

    require(underlying_address != address(0x0), "only capped token");
    VotingVault votingVault = VotingVault(voting_vault);
    votingVault.votingVaultControllerTransfer(underlying_address, target, amount);
  }

  /// @notice create a new vault
  /// @param id of an existing vault
  /// @return address of the new vault
  function mintVault(uint96 id) public returns (address) {
    if (_vaultId_votingVaultAddress[id] == address(0)) {
      address vault_address = _vaultController.vaultAddress(id);
      if (vault_address != address(0)) {
        // mint the vault itself, deploying the contract
        address voting_vault_address = address(
          new VotingVault(id, vault_address, address(_vaultController), address(this))
        );
        // add the vault to our system
        _vaultId_votingVaultAddress[id] = voting_vault_address;
        _vaultAddress_vaultId[vault_address] = id;
        _votingVaultAddress_vaultId[voting_vault_address] = id;
        // emit the event
        emit NewVotingVault(voting_vault_address, id);
      }
    }
    return _vaultId_votingVaultAddress[id];
  }

  /**
function mintBptVault(uint96 id) public returns (address) {
    console.log("MIT BPT VAULT");
    if (_vaultId_vaultBPTaddress[id] == address(0)) {
      console.log("getting adr");
      console.log(address(_vaultController));
      //standard vault address
      address vault_address = _vaultController.vaultAddress(id);
      console.log("got adr");

      //if a standard vault exists already
      if (vault_address != address(0)) {
        // mint the vault itself, deploying the contract
        address bpt_vault_address = address(new VaultBPT(id, vault_address, address(_vaultController), address(this)));
        console.log("MINTED");
        // add the vault to our system
        _vaultId_vaultBPTaddress[id] = bpt_vault_address;
        _vaultAddress_vaultId[vault_address] = id;
        _vaultBPTaddress_vaultId[bpt_vault_address] = id;
        // emit the event
        emit NewVaultBPT(bpt_vault_address, id);
      }
    }
    return _vaultId_vaultBPTaddress[id];
  }
   */

  function votingVaultId(address voting_vault_address) public view returns (uint96) {
    return _votingVaultAddress_vaultId[voting_vault_address];
  }

  function vaultId(address vault_address) public view returns (uint96) {
    return _vaultAddress_vaultId[vault_address];
  }

  function votingVaultAddress(uint96 vault_id) public view returns (address) {
    return _vaultId_votingVaultAddress[vault_id];
  }

  /**
   function BPTvaultId(address vault_bpt_address) public view returns (uint96) {
    return _vaultBPTaddress_vaultId[vault_bpt_address];
  }

  function BPTvaultAddress(uint96 vault_id) public view returns (address) {
    return _vaultId_vaultBPTaddress[vault_id];
  }
 */
}
