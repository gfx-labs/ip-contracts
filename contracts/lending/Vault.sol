// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../token/IUSDI.sol";
import "../_external/IERC20.sol";
import "../_external/compound/ExponentialNoError.sol";
import "./IVault.sol";
import "./IVaultMaster.sol";


// the mantissa for ExponentialNoError is 1e18
// so to store 5, you store 5e18

// our implentation of maker vaults
// vaults are multi-collateral
// vaults generate interest in USDI
contract Vault is IVault, ExponentialNoError {

  uint256 public _id;

  address public _minter;
  address private _usdiAddress;
  IUSDI private _usdi;

  address public _masterAddress;
  IVaultMaster private _master;


  mapping(address=>uint256) _balances;

  uint256 public _baseLiability;

  modifier masterOnly() {
    require(msg.sender == _masterAddress);
    _;
  }

  modifier minterOnly(){
    require(msg.sender == _minter);
    _;
  }

  constructor(uint256 id, address minter, address master_address, address usdi_address){
    _id = id;
    _minter = minter;
    _usdiAddress = usdi_address;
    _usdi = IUSDI(usdi_address);

    _masterAddress = master_address;
    _master = IVaultMaster(master_address);
  }

  function getMinter() override external view returns(address){
    return _minter;
  }

  function getBaseLiability() override external view returns (uint256){
    return _baseLiability;
  }

  function getBalances(address addr) override external view returns (uint256){
    return _balances[addr];
  }

  function deposit_erc20(address token_address, uint256 amount) override external {
    require(amount > 0, "cannot deposit 0");
    IERC20 token = IERC20(token_address);
    token.transferFrom(msg.sender,address(this),amount);
    _balances[token_address] = _balances[token_address] + amount;
  }

  function withdraw_erc20(address token_address, uint256 amount) override external minterOnly {
    require(_balances[token_address] > amount, "cannot withdraw more than you owe");
    IERC20 token = IERC20(token_address);
    token.transferFrom(address(this),msg.sender,amount);
    _balances[token_address] = _balances[token_address] - amount;
    bool solvency = _master.check_account(_id);
    require(solvency, "this withdraw would make your account insolvent");
  }

  function claim_erc20(address token_address, uint256 amount) override external masterOnly returns (uint256){
    IERC20 token = IERC20(token_address);
    if(_balances[token_address] > amount){
      token.transferFrom(address(this),_masterAddress,amount);
      _balances[token_address] = _balances[token_address] - amount;
      return amount;
    }
    token.transferFrom(address(this),_masterAddress,_balances[token_address]);
    _balances[token_address] = 0;
    return _balances[token_address];
  }

  function decrease_liability(uint256 base_amount) override external masterOnly returns (uint256) {
    require(_baseLiability >= base_amount, "cannot repay more than is owed");
    _baseLiability = _baseLiability - base_amount;
    return _baseLiability;
  }
  function increase_liability(uint256 base_amount) override external masterOnly returns (uint256) {
    _baseLiability = _baseLiability + base_amount;
    return _baseLiability;
  }
}
