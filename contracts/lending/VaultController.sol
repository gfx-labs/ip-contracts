// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../token/IUSDI.sol";
import "../oracle/OracleMaster.sol";
import "../curve/CurveMaster.sol";

import "./IVaultController.sol";
import "./Vault.sol";
import "./IVault.sol";

import "../_external/Ownable.sol";
import "../_external/IERC20.sol";
import "../_external/compound/ExponentialNoError.sol";

import "hardhat/console.sol";

contract VaultController is IVaultController, ExponentialNoError, Ownable {
    address[] public _enabledTokens;

    address public _oracleMasterAddress;
    OracleMaster _oracleMaster;

    address public _curveMasterAddress;
    CurveMaster _curveMaster;

    address public _usdiAddress;
    IUSDI _usdi;

    uint256 public _vaultsMinted;
    uint256 public _tokensRegistered;

    uint256 public _totalBaseLiability;

    uint256 public _lastInterestTime;

    // usdi owed = _interestFactor * baseLiability;
    // this is the interest factor * 1e18
    uint256 public _interestFactor;

    uint256 public _protocolFee;

    // mapping of vault id to vault address
    mapping(uint256 => address) public _vaultId_vaultAddress;

    // mapping of token address to token id
    mapping(address => uint256) public _tokenAddress_tokenId;

    //mapping of tokenId to the LTV*1
    mapping(uint256 => uint256) public _tokenId_tokenLTV;

    //mapping of tokenId to its corresponding oracleAddress (which are addresses)
    mapping(uint256 => address) public _tokenId_oracleAddress;

    //mapping of token address to its corresponding liquidation incentive
    mapping(address => uint256) public _tokenAddress_liquidationIncentive;

    constructor() Ownable() {
        _vaultsMinted = 0;
        _tokensRegistered = 0;
        _interestFactor = 1e18; // initialize at 1e18;
        _totalBaseLiability = 0;
        _protocolFee = 1e14;
        _lastInterestTime = block.timestamp;
    }

    function mint_vault() public returns (address) {
        _vaultsMinted = _vaultsMinted + 1;
        address vault_address = address(
            new Vault(_vaultsMinted, msg.sender, address(this), _usdiAddress)
        );
        _vaultId_vaultAddress[_vaultsMinted] = vault_address;

        emit NewVault(vault_address, _vaultsMinted, msg.sender);
        return vault_address;
    }

    function register_usdi(address usdi_address) external onlyOwner {
        _usdiAddress = usdi_address;
        _usdi = IUSDI(usdi_address);
    }

    function register_oracle_master(address master_oracle_address)
        external
        onlyOwner
    {
        _oracleMasterAddress = master_oracle_address;
        _oracleMaster = OracleMaster(_oracleMasterAddress);

        emit RegisterOracleMaster(_oracleMasterAddress);
    }

    function register_curve_master(address master_curve_address)
        external
        onlyOwner
    {
        _curveMasterAddress = master_curve_address;
        _curveMaster = CurveMaster(_curveMasterAddress);

        emit RegisterCurveMaster(_curveMasterAddress);
    }

    function getInterestFactor() external view override returns (uint256) {
        return _interestFactor;
    }

    function getProtocolFee() external view override returns (uint256) {
        return _protocolFee;
    }

    function change_protocol_fee(uint256 new_protocol_fee) external onlyOwner {
        require(new_protocol_fee < 5000, "fee is too large");
        _protocolFee = new_protocol_fee;

        emit NewProtocolFee(_protocolFee);
    }

    function register_erc20(
        address token_address,
        uint256 LTV,
        address oracle_address,
        uint256 liquidationIncentive
    ) external onlyOwner {
        require(
            _oracleMaster._relays(oracle_address) != address(0x0),
            "oracle does not exist"
        );
        require(
            _tokenAddress_tokenId[token_address] == 0,
            "token already registered"
        );
        _tokensRegistered = _tokensRegistered + 1;
        _tokenAddress_tokenId[token_address] = _tokensRegistered;
        _tokenId_oracleAddress[_tokensRegistered] = oracle_address;
        _enabledTokens.push(token_address);
        _tokenId_tokenLTV[_tokensRegistered] = LTV;
        _tokenAddress_liquidationIncentive[
            token_address
        ] = liquidationIncentive;

        emit RegisteredErc20(
            token_address,
            LTV,
            oracle_address,
            liquidationIncentive
        );
    }

    function update_registered_erc20(
        address token_address,
        uint256 LTV,
        address oracle_address,
        uint256 liquidationIncentive
    ) external onlyOwner {
        require(
            _oracleMaster._relays(oracle_address) != address(0x0),
            "oracle does not exist"
        );
        require(
            _tokenAddress_tokenId[token_address] != 0,
            "token is not registered"
        );
        _tokenId_oracleAddress[_tokensRegistered] = oracle_address;
        _tokenId_tokenLTV[_tokensRegistered] = LTV;
        _tokenAddress_liquidationIncentive[
            token_address
        ] = liquidationIncentive;

        emit UpdateRegisteredErc20(
            token_address,
            LTV,
            oracle_address,
            liquidationIncentive
        );
    }

    function check_account(uint256 id) external view override returns (bool) {
        address vault_address = _vaultId_vaultAddress[id];
        require(vault_address != address(0x0), "vault does not exist");
        IVault vault = IVault(vault_address);
        uint256 total_liquidity_value = get_vault_borrowing_power(vault);
        uint256 usdi_liability = (vault.getBaseLiability() * _interestFactor) /
            1e18;
        return (total_liquidity_value >= usdi_liability);
    }

    function borrow_usdi(uint256 id, uint256 amount) external override {
        pay_interest();
        address vault_address = _vaultId_vaultAddress[id];
        require(vault_address != address(0x00), "vault does not exist");
        IVault vault = IVault(vault_address);
        require(
            msg.sender == vault.getMinter(),
            "only vault creator may borrow from their vault"
        );

        uint256 base_amount = div_(amount * 1e18, _interestFactor);

        uint256 base_liability = vault.increase_liability(base_amount);

        _totalBaseLiability = _totalBaseLiability + base_amount;

        uint256 usdi_liability = truncate(_interestFactor * base_liability);

        uint256 total_liquidity_value = get_vault_borrowing_power(vault);

        bool solvency = (total_liquidity_value >= usdi_liability);
        require(solvency, "account insolvent");

        _usdi.vault_master_mint(msg.sender, amount);

        emit BorrowUSDi(id, vault_address, amount);
    }

    function repay_usdi(uint256 id, uint256 amount) external override {
        pay_interest();
        address vault_address = _vaultId_vaultAddress[id];
        require(vault_address != address(0x0), "vault does not exist");
        IVault vault = IVault(vault_address);

        uint256 base_amount = div_(amount * 1e18, _interestFactor);
        _totalBaseLiability = _totalBaseLiability - base_amount;
        require(
            base_amount <= vault.getBaseLiability(),
            "cannot repay more than is borrowed"
        );
        vault.decrease_liability(base_amount);
        _usdi.vault_master_burn(msg.sender, amount);
        emit RepayUSDi(id, vault_address, amount);
    }

    function repay_all_usdi(uint256 id) external override {
        pay_interest();
        address vault_address = _vaultId_vaultAddress[id];
        require(vault_address != address(0x0), "vault does not exist");
        IVault vault = IVault(vault_address);

        Exp memory interest_factor = Exp({mantissa: _interestFactor});
        uint256 usdi_liability = truncate(
            ExponentialNoError.mul_ScalarTruncate(
                interest_factor,
                vault.getBaseLiability()
            )
        );
        vault.decrease_liability(vault.getBaseLiability());
        _usdi.vault_master_burn(msg.sender, usdi_liability);

        emit RepayUSDi(id, vault_address, usdi_liability);
    }

    ///@param tokens_to_liquidate - number of tokens to liquidate
    function liquidate_account(
        uint256 id,
        address asset_address,
        uint256 tokens_to_liquidate
    ) external override returns (uint256) {
        pay_interest();
        address vault_address = _vaultId_vaultAddress[id];
        require(vault_address != address(0x0), "vault does not exist");
        require(
            IERC20(asset_address).balanceOf(vault_address) > 0,
            "Vault does not hold any of this asset"
        );
        IVault vault = IVault(vault_address);
        uint256 vault_borrowing_power = get_vault_borrowing_power(vault);

        (uint256 tokenAmount, uint256 badFillPrice) = _liquidationMath(
            id,
            asset_address,
            tokens_to_liquidate
        );
        if (tokenAmount != 0) {
            tokens_to_liquidate = tokenAmount;
        }

        uint256 usdi_to_repurchase = truncate(
            badFillPrice * tokens_to_liquidate
        );

        //decrease by base amount -- switch to truncate?
        vault.decrease_liability(
            div_(usdi_to_repurchase * 1e18, _interestFactor)
        );

        //decrease liquidators usdi balance
        _usdi.vault_master_burn(msg.sender, usdi_to_repurchase);

        // finally, we deliver the tokens to the liquidator
        vault.masterTransfer(asset_address, msg.sender, tokens_to_liquidate);

        //possible to reach this?
        require(
            get_vault_borrowing_power(vault) <= _get_account_liability(id),
            "vault solvent - liquidation amount too high"
        );
        emit Liquidate(
            id,
            asset_address,
            usdi_to_repurchase,
            tokens_to_liquidate
        );
        return tokens_to_liquidate;
    }

    /******* get things *******/
    function getTokensToLiquidate(
        uint256 id,
        address asset_address,
        uint256 tokens_to_liquidate
    ) external view returns (uint256 tokenAmount) {
        console.log("About to do liquidation math");
        (
            tokenAmount, /*uint256 badFillPrice*/

        ) = _liquidationMath(id, asset_address, tokens_to_liquidate);
        console.log("tokenAmount: ", tokenAmount);
        return tokenAmount;
    }

    function _liquidationMath(
        uint256 id,
        address asset_address,
        uint256 tokens_to_liquidate
    ) internal view returns (uint256, uint256) {
        address vault_address = _vaultId_vaultAddress[id];
        require(vault_address != address(0x0), "vault does not exist");
        require(
            IERC20(asset_address).balanceOf(vault_address) > 0,
            "Vault does not hold any of this asset"
        );
        IVault vault = IVault(vault_address);
        uint256 vault_borrowing_power = get_vault_borrowing_power(vault);

        //get the price of the asset scaled to decimal 18
        uint256 price = _oracleMaster.get_live_price(asset_address);

        // liquidation penalty
        uint256 badFillPrice = truncate(
            price * (1e18 - _tokenAddress_liquidationIncentive[asset_address])
        );
        //console.log("numerator",_get_account_liability(id) - vault_borrowing_power);
        uint256 denominator = truncate(
            price *
                ((1e18 - _tokenAddress_liquidationIncentive[asset_address]) -
                    _tokenId_tokenLTV[_tokenAddress_tokenId[asset_address]])
        );
        //console.log("denominator",denominator);
        uint256 max_tokens_to_liquidate = ((_get_account_liability(id) -
            vault_borrowing_power) * 1e18) / denominator;
        //console.log("max_tokens_to_liquidate",max_tokens_to_liquidate);
        //if ideal amount isnt possible update with vault balance
        if (tokens_to_liquidate > max_tokens_to_liquidate) {
            tokens_to_liquidate = max_tokens_to_liquidate;
        }
        //if ideal amount isnt possible update with vault balance
        if (tokens_to_liquidate > vault.getBalances(asset_address)) {
            tokens_to_liquidate = vault.getBalances(asset_address);
        }
        console.log("tokens_to_liquidate: ", tokens_to_liquidate);
        return (tokens_to_liquidate, badFillPrice);
    }

    function get_account_liability(uint256 id)
        external
        view
        override
        returns (uint256)
    {
        return _get_account_liability(id);
    }

    function _get_account_liability(uint256 id)
        internal
        view
        returns (uint256)
    {
        address vault_address = _vaultId_vaultAddress[id];
        require(vault_address != address(0x0), "vault does not exist");
        IVault vault = IVault(vault_address);

        return truncate(vault.getBaseLiability() * _interestFactor);
    }

    function account_borrowing_power(uint256 id)
        external
        view
        returns (uint256)
    {
        return get_vault_borrowing_power(IVault(_vaultId_vaultAddress[id]));
    }

    ///@dev total_liquidity_value
    function get_vault_borrowing_power(IVault vault)
        private
        view
        returns (uint256)
    {
        uint256 total_liquidity_value = 0;
        for (uint256 i = 1; i <= _tokensRegistered; i++) {
            address token_address = _enabledTokens[i - 1];
            uint256 raw_price = uint256(
                _oracleMaster.get_live_price(token_address)
            );
            if (raw_price != 0) {
                uint256 balance = vault.getBalances(token_address);
                uint256 token_value = truncate(
                    mul_ScalarTruncate(Exp({mantissa: raw_price}), balance) *
                        _tokenId_tokenLTV[i]
                );

                total_liquidity_value = total_liquidity_value + token_value;
            }
        }
        return total_liquidity_value;
    }

    /******* calculate and pay interest *******/
    function calculate_interest() external override {
        pay_interest();
    }

    function pay_interest() private {
        uint256 timeDifference = block.timestamp - _lastInterestTime;

        int256 reserve_ratio = int256(_usdi.reserveRatio());
        int256 int_curve_val = _curveMaster.get_value_at(
            address(0x00),
            reserve_ratio
        );
        require(int_curve_val >= 0, "rate too small");

        uint256 curve_val = uint256(int_curve_val);
        uint256 e18_factor_increase = truncate(
            mul_ScalarTruncate(
                Exp({mantissa: (timeDifference * 1e18) / (365 days + 6 hours)}),
                curve_val
            ) * _interestFactor
        );
        uint256 valueBefore = truncate(_totalBaseLiability * _interestFactor);
        _interestFactor = _interestFactor + e18_factor_increase;
        uint256 valueAfter = truncate(_totalBaseLiability * _interestFactor);

        if (valueAfter > valueBefore) {
            uint256 protocolAmount = truncate(
                (valueAfter - valueBefore) * (_protocolFee)
            );
            _usdi.vault_master_donate(
                valueAfter - valueBefore - protocolAmount
            );
            _usdi.vault_master_mint(owner(), protocolAmount);
        }
        _lastInterestTime = block.timestamp;
        emit Interest(block.timestamp, e18_factor_increase);
    }
}
