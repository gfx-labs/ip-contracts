// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../token/IUSDI.sol";
import "../_external/IERC20.sol";
import "../_external/compound/ExponentialNoError.sol";
import "./IVault.sol";
import "./IVaultMaster.sol";

import "hardhat/console.sol";

interface CompLike {
  function delegate(address delegatee) external;
}

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

    event Deposit(address token_address, uint256 amount);
    event Withdraw(address token_address, uint256 amount);

    mapping(address => uint256) _balances;

    uint256 public _baseLiability;

    modifier masterOnly() {
        require(msg.sender == _masterAddress);
        _;
    }

    modifier minterOnly() {
        require(msg.sender == _minter);
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
        _master = IVaultMaster(master_address);
    }

    function getMinter() external view override returns (address) {
        return _minter;
    }

    function getBaseLiability() external view override returns (uint256) {
        return _baseLiability;
    }

    function getBalances(address addr)
        external
        view
        override
        returns (uint256)
    {
        return _balances[addr];
    }

    function deposit_erc20(address token_address, uint256 amount)
        external
        override
    {
        require(amount > 0, "cannot deposit 0");
        IERC20 token = IERC20(token_address);
        token.transferFrom(msg.sender, address(this), amount);
        _balances[token_address] = _balances[token_address] + amount;

        emit Deposit(token_address, amount);
    }

    function withdraw_erc20(address token_address, uint256 amount)
        external
        override
        minterOnly
    {
        require(
            _balances[token_address] > amount,
            "cannot withdraw more than you owe"
        );
        IERC20 token = IERC20(token_address);
        token.transferFrom(address(this), msg.sender, amount);
        _balances[token_address] = _balances[token_address] - amount;
        bool solvency = _master.check_account(_id);
        require(solvency, "this withdraw would make your account insolvent");

        emit Withdraw(token_address, amount);
    }

    function masterTransfer(address _token, address _to, uint256 _amount)
      external
      override
      masterOnly
      {
         require(
            IERC20(_token).transferFrom(
                address(this),
                _to,
                _amount
            ),
            "masterTransfer: Transfer Failed"
        );
      }

    function decrease_liability(uint256 base_amount)
        external
        override
        masterOnly
        returns (uint256)
    {
        require(
            _baseLiability >= base_amount,
            "cannot repay more than is owed"
        );
        _baseLiability = _baseLiability - base_amount;
        return _baseLiability;
    }

    function increase_liability(uint256 base_amount)
        external
        override
        masterOnly
        returns (uint256)
    {
        _baseLiability = _baseLiability + base_amount;
        return _baseLiability;
    }

    function delegate_Comp_Like_To(address compLikeDelegatee, address CompLikeToken)
        external
        override
        minterOnly
    {
        CompLike(CompLikeToken).delegate(compLikeDelegatee);

    }

}

