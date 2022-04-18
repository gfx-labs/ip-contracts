// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IUSDI.sol";

import "./token/UFragments.sol";
import "./lending/Vault.sol";

import "./_external/IERC20.sol";
import "./_external/compound/ExponentialNoError.sol";
import "./_external/openzeppelin/PausableUpgradeable.sol";

contract USDI is Initializable, PausableUpgradeable, UFragments, IUSDI, ExponentialNoError {
  address public _reserveAddress;
  IERC20 public _reserve;

  address public _lenderAddress;
  address public _VaultControllerAddress;
  IVaultController private _VaultController;

  modifier onlyVaultController() {
    require(msg.sender == _VaultControllerAddress, "only vault master");
    _;
  }

  event Deposit(address indexed _from, uint256 _value);
  event Withdraw(address indexed _from, uint256 _value);
  event Mint(address to, uint256 _value);
  event Burn(address from, uint256 _value);
  event Donation(address indexed _from, uint256 _value, uint256 _totalSupply);

  function initialize(address reserveAddress) public initializer {
    __UFragments_init("USDI Token", "USDI");
    __Pausable_init();
    _reserveAddress = reserveAddress;
    _reserve = IERC20(_reserveAddress);
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  function deposit(uint256 usdc_amount) external override whenNotPaused {
    uint256 amount = usdc_amount * 1e12;
    require(amount > 0, "Cannot deposit 0");
    uint256 allowance = _reserve.allowance(msg.sender, address(this));
    require(allowance >= usdc_amount, "Insufficient Allowance");
    _reserve.transferFrom(msg.sender, address(this), usdc_amount);
    _gonBalances[msg.sender] = _gonBalances[msg.sender] + amount * _gonsPerFragment;
    _totalSupply = _totalSupply + amount;
    _totalGons = _totalGons + amount * _gonsPerFragment;
    emit Deposit(msg.sender, amount);
  }

  function withdraw(uint256 usdc_amount) external override whenNotPaused {
    uint256 amount = usdc_amount * 1e12;
    require(amount > 0, "Cannot withdraw 0");
    //uint256 allowance = this.allowance(msg.sender, address(this));
    //require(allowance >= usdc_amount, "Insufficient Allowance");
    uint256 balance = _reserve.balanceOf(address(this));
    require(balance >= usdc_amount, "Insufficient Reserve in Bank");
    _reserve.approve(address(this), usdc_amount);
    _reserve.transferFrom(address(this), msg.sender, usdc_amount);
    _gonBalances[msg.sender] = _gonBalances[msg.sender] - amount * _gonsPerFragment;
    _totalSupply = _totalSupply - amount;
    _totalGons = _totalGons - amount * _gonsPerFragment;
    emit Withdraw(msg.sender, amount);
  }

  function setVaultController(address vault_master_address) external override onlyOwner {
    _VaultControllerAddress = vault_master_address;
    _VaultController = IVaultController(vault_master_address);
  }

  function mint(uint256 usdc_amount) external override onlyOwner {
    _VaultController.calculateInterest();
    uint256 amount = usdc_amount * 1e12;
    if (amount <= 0) {
      return;
    }
    _gonBalances[msg.sender] = _gonBalances[msg.sender] + amount * _gonsPerFragment;
    _totalSupply = _totalSupply + amount;
    _totalGons = _totalGons + amount * _gonsPerFragment;
    emit Mint(msg.sender, amount);
  }

  function burn(uint256 usdc_amount) external override onlyOwner {
    _VaultController.calculateInterest();
    if (usdc_amount <= 0) {
      return;
    }
    uint256 amount = usdc_amount * 1e12;
    _gonBalances[msg.sender] = _gonBalances[msg.sender] - amount * _gonsPerFragment;
    _totalSupply = _totalSupply - amount;
    _totalGons = _totalGons - amount * _gonsPerFragment;
    emit Burn(msg.sender, amount);
  }

  function vault_master_mint(address target, uint256 amount) external override onlyVaultController {
    _gonBalances[target] = _gonBalances[target] + amount * _gonsPerFragment;
    _totalSupply = _totalSupply + amount;
    _totalGons = _totalGons + amount * _gonsPerFragment;
    emit Mint(target, amount);
  }

  function vault_master_burn(address target, uint256 amount) external override onlyVaultController {
    require(_gonBalances[target] > (amount * _gonsPerFragment), "USDI: not enough balance");
    _gonBalances[target] = _gonBalances[target] - amount * _gonsPerFragment;
    _totalSupply = _totalSupply - amount;
    _totalGons = _totalGons - amount * _gonsPerFragment;
    emit Burn(target, amount);
  }

  function vault_master_donate(uint256 amount) external override onlyVaultController {
    _totalSupply = _totalSupply + amount;
    if (_totalSupply > MAX_SUPPLY) {
      _totalSupply = MAX_SUPPLY;
    }
    _gonsPerFragment = _totalGons / _totalSupply;
    emit Donation(msg.sender, amount, _totalSupply);
  }

  function reserveRatio() external view override returns (uint256 e18_reserve_ratio) {
    e18_reserve_ratio = ((_reserve.balanceOf(address(this)) * ExponentialNoError.expScale) / _totalSupply) * 1e12;
  }
}
