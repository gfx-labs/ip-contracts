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

//testing
import "hardhat/console.sol";

interface IOETH {
  function rebaseOptIn() external;
}

//0xDcEe70654261AF21C44c093C300eD3Bb97b78192
interface IWOETH {
  // mints exactly shares vault shares to receiver by depositing assets of underlying tokens.
  function mint(uint256 shares, address receiver) external returns (uint256 assets);

  // deposits assets of underlying tokens into the vault and grants ownership of shares to receiver
  function deposit(uint256 assets, address receiver) external returns (uint256 shares);

  // redeems a specific number of shares from owner and sends assets of underlying token from the vault to receiver
  function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

  // burns shares from owner and send exactly assets token from the vault to receiver
  function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
}

/// @title CappedOETH
/// @notice Wraps OETH to wOETH
/// @notice Users can deposit OETH, which is wrapped to wOETH before being sent to the vault
/// @dev logic is otherwise the same as CappedGovToken
/// @dev extends ierc20 upgradable
contract CappedOETH is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  using SafeERC20Upgradeable for ERC20Upgradeable;

  ERC20Upgradeable public _underlying;
  IVaultController public _vaultController;
  VotingVaultController public _votingVaultController;

  IWOETH public constant woeth = IWOETH(0xDcEe70654261AF21C44c093C300eD3Bb97b78192);

  // in actual units
  uint256 public _cap;

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ the address of underlying, should be OETH
  /// @param vaultController_ the address of vault controller
  /// @param votingVaultController_ the address of voting vault controller
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

    //opt into rebase
    //IOETH(underlying_).rebaseOptIn();
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
  function deposit(uint256 amount, uint96 vaultId) public {
    require(amount > 0, "Cannot deposit 0");
    VotingVault votingVault = VotingVault(_votingVaultController.votingVaultAddress(vaultId));
    require(address(votingVault) != address(0x0), "invalid voting vault");
    IVault vault = IVault(_vaultController.vaultAddress(vaultId));
    require(address(vault) != address(0x0), "invalid vault");
    // check cap
    checkCap(amount);
    // check allowance and ensure transfer success
    uint256 allowance = _underlying.allowance(_msgSender(), address(this));
    require(allowance >= amount, "Insufficient Allowance");

    console.log("bouda wrap");
    uint256 shares = wrap(amount, address(votingVault));

    // mint this token, the collateral token, to the vault
    ERC20Upgradeable._mint(address(vault), shares);
  }

  function wrap(uint256 amount, address votingVault) internal returns (uint256) {
    // send the actual underlying here so we can wrap it first
    _underlying.safeTransferFrom(_msgSender(), address(this), amount);

    //now we have the OETH, so we can wrap to wOETH

    console.log("Approving: ", _underlying.balanceOf(address(this)));

    _underlying.approve(address(woeth), amount);

    console.log("Wrapping: ", _underlying.balanceOf(address(this)));

    //send woeth to voting vault
    return woeth.deposit(amount, votingVault);
  }

  function transfer(address recipient, uint256 amount) public override returns (bool) {
    uint96 vault_id = _votingVaultController.vaultId(_msgSender());
    // only vaults will ever send this. only vaults will ever hold this token.
    require(vault_id > 0, "only vaults");
    // get the corresponding voting vault
    address voting_vault_address = _votingVaultController.votingVaultAddress(vault_id);
    require(voting_vault_address != address(0x0), "no voting vault");
    console.log("Burning");
    // burn the collateral tokens from the sender, which is the vault that holds the collateral tokens
    ERC20Upgradeable._burn(_msgSender(), amount);
    console.log("Getting", amount);

    // move the underlying tokens from voting vault to the target
    _votingVaultController.retrieveUnderlying(amount, voting_vault_address, recipient);

    console.log("GOT");
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
