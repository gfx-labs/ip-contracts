// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IUSDI.sol";

import "./IVault.sol";
import "./IVaultController.sol";

import "../_external/CompLike.sol";
import "../_external/IERC20.sol";
import "../_external/Context.sol";
import "../_external/compound/ExponentialNoError.sol";



/// @title A users vault
/// @notice our implentation of maker-vault like vault
/// major differences:
/// 1. multi-collateral
/// 2. generate interest in USDI
/// 3. can delegate voting power of contained tokens
contract Vault is IVault, ExponentialNoError, Context {
    uint256 public _id;
    address public _minter;
    address private _usdiAddress;
    IUSDI private _usdi;

    address public _VaultControllerAddress;
    IVaultController private _master;

    event Deposit(address token_address, uint256 amount);
    event Withdraw(address token_address, uint256 amount);

    uint256 public _baseLiability;

    /// @notice checks if _msgSender is the controller of the vault
    modifier onlyVaultController() {
        require(
            _msgSender() == _VaultControllerAddress,
            "sender not VaultController"
        );
        _;
    }

    /// @notice checks if _msgSender is the minter of the vault
    modifier onlyMinter() {
        require(_msgSender() == _minter, "sender not minter");
        _;
    }

    /// @notice must be called by VaultController, else it will not be registered as a vault in system
    /// @param id unique id of the vault, ever increasing and tracked by VaultController
    /// @param minter address of the person who created this vault
    /// @param master_address address of the VaultController
    /// @param usdi_address address of the Usdi contract
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
        _VaultControllerAddress = master_address;
        _master = IVaultController(master_address);
    }

    /// @notice minter of the vault
    /// @return address of minter
    function Minter() external view override returns (address) {
        return _minter;
    }

    /// @notice current vault base liability
    /// @return base liability of vault
    function BaseLiability() external view override returns (uint256) {
        return _baseLiability;
    }

    /// @notice get vaults balance of an erc20 token
    /// @param addr address of the erc20 token
    /// @dev all this does is call IERC20(addr).balanceOf(address(this))
    /// this is here to serve as a reminder that we can possibly modify this function in the future
    function tokenBalance(address addr)
        external
        view
        override
        returns (uint256)
    {
        return IERC20(addr).balanceOf(address(this));
    }

    /// @notice withdraw an erc20 token from the vault
    /// this can only be called by the minter
    /// the withdraw will be denied if ones vault would become insolvent
    /// @param token_address address of erc20 token
    /// @param amount amount of erc20 token to withdraw
    function withdrawErc20(address token_address, uint256 amount)
        external
        override
        onlyMinter
    {
        IERC20 token = IERC20(token_address);
        token.transferFrom(address(this), _msgSender(), amount);
        bool solvency = _master.checkAccount(_id);
        require(solvency, "over-withdrawal");

        emit Withdraw(token_address, amount);
    }
    /// @notice delegate the voting power of a comp-like erc20 token to another address
    /// @param delegatee address that will receive the votes
    /// @param token_address address of comp-like erc20 token
    function delegateCompLikeTo(
        address delegatee,
        address token_address
    ) external override onlyMinter {
        CompLike(token_address).delegate(delegatee);
    }

    /// @notice function used by the VaultController to transfer tokens
    /// callable by the VaultController only
    /// @param _token token to transfer
    /// @param _to person to send the coins to
    /// @param _amount amount of coins to move
    function masterTransfer(
        address _token,
        address _to,
        uint256 _amount
    ) external override onlyVaultController {
        require(
            IERC20(_token).transferFrom(address(this), _to, _amount),
            "masterTransfer: Transfer Failed"
        );
    }

    /// @notice function used by the VaultController to reduce a vaults liability
    /// callable by the VaultController only
    /// @param base_amount amount to reduce base liability by
    function decrease_liability(uint256 base_amount)
        external
        override
        onlyVaultController
        returns (uint256)
    {
        require(
            _baseLiability >= base_amount,
            "cannot repay more than is owed"
        );
        _baseLiability = _baseLiability - base_amount;
        return _baseLiability;
    }

    /// @notice function used by the VaultController to increase a vaults liability
    /// callable by the VaultController only
    /// @param base_amount amount to reduce base liability by
    function increase_liability(uint256 base_amount)
        external
        override
        onlyVaultController
        returns (uint256)
    {
        _baseLiability = _baseLiability + base_amount;
        return _baseLiability;
    }
}
