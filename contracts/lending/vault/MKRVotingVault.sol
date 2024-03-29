// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {IVault} from "../IVault.sol";
import {IVaultController} from "../IVaultController.sol";
import "../../_external/IERC20.sol";
import "../../_external/Context.sol";
import "../../_external/openzeppelin/SafeERC20Upgradeable.sol";

import {MKRLike} from "../../_external/MKRLike.sol";
import {MKRVotingVaultController} from "../controller/MKRVotingVaultController.sol";

interface VoteDelegate {
  function iou() external view returns (IERC20);

  function gov() external view returns (address);

  function stake(address staker) external view returns (uint256);
}

contract MKRVotingVault is Context {
  using SafeERC20Upgradeable for IERC20;

  error OnlyMinter();
  error OnlyMKRVotingVaultController();
  error OnlyVaultController();

  /// @title MKRVotingVault
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

  struct DelegationStatus {
    address delegatee;
    bool delegated;
  }

  ///@notice delegation status per mkrLikeToken
  ///@notice all or nothing delegation per mkrLikeToken
  mapping(address => DelegationStatus) public delegationStatuses;

  /// @notice Metadata of vault, aka the id & the minter's address
  VaultInfo private _vaultInfo;

  MKRVotingVaultController public _mkrVotingVaultController;
  IVaultController public _vaultController;

  /// @notice checks if _msgSender is the controller of the voting vault
  modifier onlyMKRVotingVaultController() {
    if (_msgSender() != address(_mkrVotingVaultController)) revert OnlyMKRVotingVaultController();
    _;
  }
  /// @notice checks if _msgSender is the controller of the vault
  modifier onlyVaultController() {
    if (_msgSender() != address(_vaultController)) revert OnlyVaultController();
    _;
  }
  /// @notice checks if _msgSender is the minter of the vault
  modifier onlyMinter() {
    if (_msgSender() != IVault(_vaultInfo.vault_address).minter()) revert OnlyMinter();
    _;
  }

  /// @notice must be called by MKRVotingVaultController, else it will not be registered as a vault in the system
  /// @param id_ is the shared ID of both the voting vault and the standard vault
  /// @param vault_address address of the vault this is attached to
  /// @param controller_address address of the VaultController
  /// @param voting_controller_address address of the MKRVotingVaultController
  constructor(uint96 id_, address vault_address, address controller_address, address voting_controller_address) {
    _vaultInfo = VaultInfo(id_, vault_address);
    _vaultController = IVaultController(controller_address);
    _mkrVotingVaultController = MKRVotingVaultController(voting_controller_address);
  }

  function parentVault() external view returns (address) {
    return address(_vaultInfo.vault_address);
  }

  function id() external view returns (uint96) {
    return _vaultInfo.id;
  }

  function delegationStatus(address mkrLikeToken) external view returns (DelegationStatus memory) {
    return delegationStatuses[mkrLikeToken];
  }

  function delegateMKRLikeTo(address delegatee, address tokenAddress) external onlyMinter {
    uint256 amount = IERC20(tokenAddress).balanceOf(address(this));

    IERC20(tokenAddress).approve(delegatee, amount);

    MKRLike(delegatee).lock(amount);

    delegationStatuses[tokenAddress] = DelegationStatus({delegatee: delegatee, delegated: true});
  }

  function undelegateMKRLike(address delegatee) external onlyMinter {
    require(delegationStatuses[VoteDelegate(delegatee).gov()].delegated, "Not delegated");
    _undelegate(delegatee);
  }

  function _undelegate(address delegatee) internal {
    IERC20 iou = VoteDelegate(delegatee).iou();
    uint256 amount = IERC20(address(iou)).balanceOf(address(this));

    iou.approve(delegatee, amount);
    MKRLike(delegatee).free(amount);

    delete delegationStatuses[VoteDelegate(delegatee).gov()];
  }

  ///@notice if delegated, we need to un-delegate to allow for liquidations
  ///@notice partial liquidation will result in full un-delegation, and re-delegation must occur again afterwords if needed
  function checkDelegation(address _token) private {
    if (delegationStatuses[_token].delegated) {
      _undelegate(delegationStatuses[_token].delegatee);
    }
  }

  /// @notice function used by the VaultController to transfer tokens
  /// callable by the VaultController only
  /// not currently in use, available for future upgrades
  /// @param _token token to transfer
  /// @param _to person to send the coins to
  /// @param _amount amount of coins to move
  function controllerTransfer(address _token, address _to, uint256 _amount) external onlyVaultController {
    checkDelegation(_token);
    SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(_token), _to, _amount);
  }

  /// @notice function used by the MKRVotingVaultController to transfer tokens
  /// callable by the MKRVotingVaultController only
  /// @param _token token to transfer
  /// @param _to person to send the coins to
  /// @param _amount amount of coins to move
  function votingVaultControllerTransfer(
    address _token,
    address _to,
    uint256 _amount
  ) external onlyMKRVotingVaultController {
    checkDelegation(_token);
    SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(_token), _to, _amount);
  }
}
