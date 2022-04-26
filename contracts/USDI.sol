// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IUSDI.sol";

import "./token/UFragments.sol";
import "./lending/Vault.sol";

import "./_external/IERC20.sol";
import "./_external/compound/ExponentialNoError.sol";
import "./_external/openzeppelin/PausableUpgradeable.sol";

import "hardhat/console.sol";

/// @title USDI token contract
/// @notice handles all minting/burning of usdi
/// @dev extends UFragments
contract USDI is Initializable, PausableUpgradeable, UFragments, IUSDI, ExponentialNoError {
  address public _reserveAddress;
  IERC20 public _reserve;

  address public _lenderAddress;
  address public _VaultControllerAddress;
  IVaultController private _VaultController;

  /// @notice checks if _msgSender() is VaultController
  modifier onlyVaultController() {
    require(_msgSender() == _VaultControllerAddress, "only VaultController");
    _;
  }
  /// @notice any function with this modifier will call the pay_interest() function before
  modifier paysInterest() {
    _VaultController.calculateInterest();
    _;
  }

  event Deposit(address indexed _from, uint256 _value);
  event Withdraw(address indexed _from, uint256 _value);
  event Mint(address to, uint256 _value);
  event Burn(address from, uint256 _value);
  event Donation(address indexed _from, uint256 _value, uint256 _totalSupply);

  /// @notice initializer for contract
  /// @param reserveAddr the address of USDC
  /// @dev consider adding decimals?
  function initialize(address reserveAddr) public override initializer {
    __UFragments_init("USDI Token", "USDI");
    __Pausable_init();
    _reserveAddress = reserveAddr;
    _reserve = IERC20(_reserveAddress);
  }

  /// @notice pause contract, owner only
  function pause() external override onlyOwner {
    _pause();
  }

  /// @notice unpause contract, owner only
  function unpause() external override onlyOwner {
    _unpause();
  }

  function owner() public view override(IUSDI, OwnableUpgradeable) returns (address) {
    return super.owner();
  }

  function name() public view override(IERC20Metadata, ERC20Detailed) returns (string memory) {
    return super.name();
  }

  function symbol() public view override(IERC20Metadata, ERC20Detailed) returns (string memory) {
    return super.symbol();
  }

  function decimals() public view override(IERC20Metadata, ERC20Detailed) returns (uint8) {
    return super.decimals();
  }

  function reserveAddress() public view override returns (address) {
    return _reserveAddress;
  }

  /**
  fallback() external payable {
    revert("Fallback");
  }

  receive() external payable {
    revert("Cannot receive ether");
  }
   */

  /// @notice deposit USDC to mint USDi
  /// caller should obtain 1e12 USDi for each USDC
  /// @param usdc_amount amount of USDC to deposit
  function deposit(uint256 usdc_amount) external override paysInterest whenNotPaused {
    uint256 amount = usdc_amount * 1e12;
    require(amount > 0, "Cannot deposit 0");
    uint256 allowance = _reserve.allowance(_msgSender(), address(this));
    require(allowance >= usdc_amount, "Insufficient Allowance");
    require(_reserve.transferFrom(_msgSender(), address(this), usdc_amount), "transfer failed");
    _gonBalances[_msgSender()] = _gonBalances[_msgSender()] + amount * _gonsPerFragment;
    _totalSupply = _totalSupply + amount;
    _totalGons = _totalGons + amount * _gonsPerFragment;

    emit Deposit(_msgSender(), amount);
  }

  /// BUG no check for user's balance?
  /// @notice withdraw USDC by burning USDi
  /// caller should obtain 1 USDC for every 1e12 USDi
  /// @param usdc_amount amount of USDC to withdraw
  function withdraw(uint256 usdc_amount) external override paysInterest whenNotPaused {
    uint256 amount = usdc_amount * 1e12;
    require(amount <= this.balanceOf(_msgSender()), "insufficient funds");
    require(amount > 0, "Cannot withdraw 0");
    uint256 balance = _reserve.balanceOf(address(this));
    require(balance >= usdc_amount, "Insufficient Reserve in Bank");
    _reserve.approve(address(this), usdc_amount);
    require(_reserve.transferFrom(address(this), _msgSender(), usdc_amount), "transfer failed");
    _gonBalances[_msgSender()] = _gonBalances[_msgSender()] - amount * _gonsPerFragment;
    _totalSupply = _totalSupply - amount;
    _totalGons = _totalGons - amount * _gonsPerFragment;
    emit Withdraw(_msgSender(), amount);
  }

  // todo I think we want withdraw_all()
  function withdraw_all() external override paysInterest whenNotPaused {
    uint256 reserve = _reserve.balanceOf(address(this));
    require(reserve != 0, "Reserve is empty");
    uint256 usdc_amount = (this.balanceOf(_msgSender())) / 1e12;
    //user's USDI value is more than reserve
    if (usdc_amount > reserve) {
      usdc_amount = reserve;
    }
    uint256 amount = usdc_amount * 1e12;
    _reserve.approve(address(this), usdc_amount);
    require(_reserve.transferFrom(address(this), _msgSender(), usdc_amount), "transfer failed");
    _gonBalances[_msgSender()] = _gonBalances[_msgSender()] - (amount * _gonsPerFragment);
    _totalSupply = _totalSupply - amount;
    _totalGons = _totalGons - (amount * _gonsPerFragment);
    emit Withdraw(_msgSender(), amount);
  }

  /// @notice set the VaultController addr so that vault_master may mint/burn USDi without restriction
  /// @param vault_master_address address of vault master
  function setVaultController(address vault_master_address) external override onlyOwner {
    _VaultControllerAddress = vault_master_address;
    _VaultController = IVaultController(vault_master_address);
  }

  /// @notice admin function to mint USDi out of thin air
  /// @param usdc_amount the amount of USDi to mint, denominated in USDC
  function mint(uint256 usdc_amount) external override paysInterest onlyOwner {
    uint256 amount = usdc_amount * 1e12;
    if (amount <= 0) {
      return;
    }
    _gonBalances[_msgSender()] = _gonBalances[_msgSender()] + amount * _gonsPerFragment;
    _totalSupply = _totalSupply + amount;
    _totalGons = _totalGons + amount * _gonsPerFragment;
    emit Mint(_msgSender(), amount);
  }

  /// @notice admin function to burn USDi
  /// @param usdc_amount the amount of USDi to burn, denominated in USDC
  function burn(uint256 usdc_amount) external override paysInterest onlyOwner {
    if (usdc_amount <= 0) {
      return;
    }
    uint256 amount = usdc_amount * 1e12;
    _gonBalances[_msgSender()] = _gonBalances[_msgSender()] - amount * _gonsPerFragment;
    _totalSupply = _totalSupply - amount;
    _totalGons = _totalGons - amount * _gonsPerFragment;
    emit Burn(_msgSender(), amount);
  }

  function donate(uint256 usdc_amount) external override paysInterest whenNotPaused {
    uint256 amount = usdc_amount * 1e12;
    require(amount > 0, "Cannot deposit 0");
    uint256 allowance = _reserve.allowance(_msgSender(), address(this));
    require(allowance >= usdc_amount, "Insufficient Allowance");
    require(_reserve.transferFrom(_msgSender(), address(this), usdc_amount), "transfer failed");

    _donation(usdc_amount);
  }

  /// @notice function for the vaultController to mint
  /// @param target whom to mint the USDi to
  /// @param amount the amount of USDi to mint
  function vault_master_mint(address target, uint256 amount) external override onlyVaultController {
    _gonBalances[target] = _gonBalances[target] + amount * _gonsPerFragment;
    _totalSupply = _totalSupply + amount;
    _totalGons = _totalGons + amount * _gonsPerFragment;
    emit Mint(target, amount);
  }

  /// @notice function for the vaultController to burn
  /// @param target whom to burn the USDi from
  /// @param amount the amount of USDi to burn
  function vault_master_burn(address target, uint256 amount) external override onlyVaultController {
    //console.log("vault_master_burn: ", amount);
    require(_gonBalances[target] > (amount * _gonsPerFragment), "USDI: not enough balance");
    _gonBalances[target] = _gonBalances[target] - amount * _gonsPerFragment;
    _totalSupply = _totalSupply - amount;
    _totalGons = _totalGons - amount * _gonsPerFragment;
    emit Burn(target, amount);
  }

  /// @notice function for the vaultController to scale all USDi balances
  /// @param amount amount of USDi to donate
  function vault_master_donate(uint256 amount) external override onlyVaultController {
    _donation(amount);
  }

  function _donation(uint256 amount) internal {
    _totalSupply = _totalSupply + amount;
    if (_totalSupply > MAX_SUPPLY) {
      _totalSupply = MAX_SUPPLY;
    }
    _gonsPerFragment = _totalGons / _totalSupply;
    emit Donation(_msgSender(), amount, _totalSupply);
  }

  /// @notice get reserve ratio
  /// @return e18_reserve_ratio USDi reserve ratio
  function reserveRatio() external view override returns (uint192 e18_reserve_ratio) {
    e18_reserve_ratio = safeu192(((_reserve.balanceOf(address(this)) * expScale) / _totalSupply) * 1e12);
  }
}
