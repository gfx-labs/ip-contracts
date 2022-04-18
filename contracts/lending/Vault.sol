// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IUSDI.sol";

import "./IVault.sol";
import "./IVaultController.sol";

import "../_external/IERC20.sol";
import "../_external/Context.sol";
import "../_external/compound/ExponentialNoError.sol";

interface CompLike {
  function delegate(address delegatee) external;
}

// the mantissa for ExponentialNoError is 1e18
// so to store 5, you store 5e18

// our implentation of maker-vault like vault
// vaults are multi-collateral
// vaults generate interest in USDI
contract Vault is IVault, ExponentialNoError, Context {
  uint256 public _id;
  address public _minter;
  address private _usdiAddress;
  IUSDI private _usdi;

  address public _masterAddress;
  IVaultController private _master;

  event Deposit(address token_address, uint256 amount);
  event Withdraw(address token_address, uint256 amount);

  uint256 public _baseLiability;

  modifier masterOnly() {
    require(_msgSender() == _masterAddress, "sender not master");
    _;
  }

  modifier minterOnly() {
    require(_msgSender() == _minter, "sender not minter");
    _;
  }

  constructor(
    uint256 id,
    address minter,
    address master_address,
    address usdi_address
  ) {
    _id = id;
    _minter = minter;
    _usdiAddress = usdi_address;
    _usdi = IUSDI(usdi_address);
    _masterAddress = master_address;
    _master = IVaultController(master_address);
  }

  function Minter() external view override returns (address) {
    return _minter;
  }

  function BaseLiability() external view override returns (uint256) {
    return _baseLiability;
  }

  function tokenBalance(address addr) external view override returns (uint256) {
    return IERC20(addr).balanceOf(address(this));
  }

  function withdrawErc20(address token_address, uint256 amount) external override minterOnly {
    IERC20 token = IERC20(token_address);
    token.transferFrom(address(this), _msgSender(), amount);
    bool solvency = _master.checkAccount(_id);
    require(solvency, "over-withdrawal");

    emit Withdraw(token_address, amount);
  }

  function delegateCompLikeTo(address compLikeDelegatee, address CompLikeToken) external override minterOnly {
    CompLike(CompLikeToken).delegate(compLikeDelegatee);
  }

  function masterTransfer(
    address _token,
    address _to,
    uint256 _amount
  ) external override masterOnly {
    require(IERC20(_token).transferFrom(address(this), _to, _amount), "masterTransfer: Transfer Failed");
  }

  function decrease_liability(uint256 base_amount) external override masterOnly returns (uint256) {
    require(_baseLiability >= base_amount, "cannot repay more than is owed");
    _baseLiability = _baseLiability - base_amount;
    return _baseLiability;
  }

  function increase_liability(uint256 base_amount) external override masterOnly returns (uint256) {
    _baseLiability = _baseLiability + base_amount;
    return _baseLiability;
  }
}
