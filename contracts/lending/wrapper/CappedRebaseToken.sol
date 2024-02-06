// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../_external/IERC20Metadata.sol";
import "../../_external/openzeppelin/ERC20Upgradeable.sol";
import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";

import {SafeERC20} from "../../_external/extensions/SafeERC20.sol";

import "hardhat/console.sol";

/// @title CappedRebaseToken - uses logic from Wrapped USDI which uses logic from WAMPL
/// @notice handles all minting/burning of underlying
/// @dev extends ierc20 upgradable
contract CappedRebaseToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
  using SafeERC20 for IERC20;

  IERC20Metadata public _underlying;
  uint8 private _underlying_decimals;

  ///@notice this cap is represented in underlying amount, not the wrapped version issued by this contract
  uint256 public _cap;

  /// @notice This must remain constant for conversions to work, the cap is separate
  uint256 public constant MAX_SUPPLY = 10000000 * (10 ** 18); // 10 M

  /// @notice initializer for contract
  /// @param name_ name of capped token
  /// @param symbol_ symbol of capped token
  /// @param underlying_ the address of underlying
  function initialize(string memory name_, string memory symbol_, address underlying_) public initializer {
    __Ownable_init();
    __ERC20_init(name_, symbol_);
    _underlying = IERC20Metadata(underlying_);
    _underlying_decimals = _underlying.decimals();
  }

  /// @notice getter for address of the underlying currency, or underlying
  /// @return decimals for of underlying currency
  function underlyingAddress() public view returns (address) {
    return address(_underlying);
  }

  ///////////////////////// CAP FUNCTIONS /////////////////////////
  /// @notice get the Cap
  /// @return cap
  function getCap() public view returns (uint256) {
    return _cap;
  }

  /// @notice set the Cap
  function setCap(uint256 cap_) external onlyOwner {
    _cap = cap_;
  }

  /// @notice check the incoming supply of underlying against the cap, which is also expressed in underlying units
  function checkCap(uint256 wrappedAmount) internal view {
    uint256 incomingUnderlyingAmount = _capped_to_underlying(wrappedAmount, _underlying.totalSupply());

    uint256 currentUnderlyingSupply = _capped_to_underlying(ERC20Upgradeable.totalSupply(), _underlying.totalSupply());

    require(currentUnderlyingSupply + incomingUnderlyingAmount <= _cap, "cap reached");
  }

  function decimals() public pure override returns (uint8) {
    return 18;
  }

  function underlyingScalar() public view returns (uint256) {
    return (10 ** (18 - _underlying_decimals));
  }

  /// @notice get underlying ratio
  /// @return e18_underlying_ratio underlying ratio of coins
  function underlyingRatio() public view returns (uint256 e18_underlying_ratio) {
    e18_underlying_ratio = (((_underlying.balanceOf(address(this)) * underlyingScalar()) * 1e18) /
      _underlying.totalSupply());
  }

  ///////////////////////// WRAP AND UNWRAP /////////////////////////

  //cappedTokenUnits

  /// @notice Transfers underlyingAmount from {msg.sender} and mints cappedTokenAmount.
  ///
  /// @param cappedTokenAmount The amount of cappedTokens to mint.
  /// @return The amount of underlyingAmount deposited.
  function mint(uint256 cappedTokenAmount) external returns (uint256) {
    checkCap(cappedTokenAmount);
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _deposit(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Transfers underlyingAmount from {msg.sender} and mints cappedTokenAmount,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to mint.
  /// @return The amount of underlyingAmount deposited.
  function mintFor(address to, uint256 cappedTokenAmount) external returns (uint256) {
    checkCap(cappedTokenAmount);
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _deposit(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Burns cappedTokenAmount from {msg.sender} and transfers underlyingAmount back.
  ///
  /// @param cappedTokenAmount The amount of cappedTokenAmount to burn.
  /// @return The amount of usdi withdrawn.
  function burn(uint256 cappedTokenAmount) external returns (uint256) {
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Burns cappedTokenAmount from {msg.sender} and transfers underlyingAmount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to burn.
  /// @return The amount of underlyingAmount withdrawn.
  function burnTo(address to, uint256 cappedTokenAmount) external returns (uint256) {
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Burns all cappedTokenAmount from {msg.sender} and transfers underlyingAmount back.
  ///
  /// @return The amount of underlyingAmount withdrawn.
  function burnAll() external returns (uint256) {
    uint256 cappedTokenAmount = balanceOf(_msgSender());
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  /// @notice Burns all cappedTokenAmount from {msg.sender} and transfers underlyingAmount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @return The amount of underlyingAmount withdrawn.
  function burnAllTo(address to) external returns (uint256) {
    uint256 cappedTokenAmount = balanceOf(_msgSender());
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return underlyingAmount;
  }

  //underlying units

  /// @notice Transfers underlyingAmount from {msg.sender} and mints cappedTokenAmount.
  ///
  /// @param underlyingAmount The amount of underlyingAmount to deposit.
  /// @return The amount of cappedTokenAmount minted.
  function deposit(uint256 underlyingAmount) external returns (uint256) {
    checkCap(underlyingAmount);
    uint256 cappedTokenAmount = _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
    _deposit(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Transfers underlyingAmount from {msg.sender} and mints cappedTokenAmount,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to deposit.
  /// @return The amount of cappedTokenAmount minted.
  function depositFor(address to, uint256 underlyingAmount) external returns (uint256) {
    checkCap(underlyingAmount);
    uint256 cappedTokenAmount = _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
    _deposit(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Burns cappedTokenAmount from {msg.sender} and transfers underlyingAmount back.
  ///
  /// @param underlyingAmount The amount of underlyingAmount to withdraw.
  /// @return The amount of burnt cappedTokenAmount.
  function withdraw(uint256 underlyingAmount) external returns (uint256) {
    uint256 cappedTokenAmount = _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Burns cappedTokenAmount from {msg.sender} and transfers underlyingAmount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to withdraw.
  /// @return The amount of burnt cappedTokenAmount.
  function withdrawTo(address to, uint256 underlyingAmount) external returns (uint256) {
    uint256 cappedTokenAmount = _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Burns all cappedTokenAmount from {msg.sender} and transfers underlyingAmount back.
  ///
  /// @return The amount of burnt cappedTokenAmount.
  function withdrawAll() external returns (uint256) {
    uint256 cappedTokenAmount = balanceOf(_msgSender());
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());

    require(underlyingAmount <= _underlying.balanceOf(address(this)), "Insufficient funds in bank");

    _withdraw(_msgSender(), _msgSender(), underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  /// @notice Burns all cappedTokenAmount from {msg.sender} and transfers underlyingAmount back,
  ///         to the specified beneficiary.
  ///
  /// @param to The beneficiary wallet.
  /// @return The amount of burnt cappedTokenAmount.
  function withdrawAllTo(address to) external returns (uint256) {
    uint256 cappedTokenAmount = balanceOf(_msgSender());
    uint256 underlyingAmount = _capped_to_underlying(cappedTokenAmount, _query_Underlying_Supply());
    _withdraw(_msgSender(), to, underlyingAmount, cappedTokenAmount);
    return cappedTokenAmount;
  }

  ///////////////////////// VIEW FUNCTIONS /////////////////////////

  /// @return The address of the underlying "wrapped" token ie) usdi.
  function underlying() external view returns (address) {
    return address(_underlying);
  }

  /// @return The total underlyingAmount held by this contract.
  function totalUnderlying() external view returns (uint256) {
    return _underlying_to_capped(totalSupply(), _query_Underlying_Supply());
  }

  /// @param owner The account address.
  /// @return The usdi balance redeemable by the owner.
  function balanceOfUnderlying(address owner) external view returns (uint256) {
    return _capped_to_underlying(balanceOf(owner), _query_Underlying_Supply());
  }

  /// @param underlyingAmount The amount of usdi tokens.
  /// @return The amount of wUSDI tokens exchangeable.
  function underlyingToWrapper(uint256 underlyingAmount) external view returns (uint256) {
    return _underlying_to_capped(underlyingAmount, _query_Underlying_Supply());
  }

  /// @param cappedAmount The amount of wUSDI tokens.
  /// @return The amount of usdi tokens exchangeable.
  function wrapperToUnderlying(uint256 cappedAmount) external view returns (uint256) {
    return _capped_to_underlying(cappedAmount, _query_Underlying_Supply());
  }

  ///////////////////////// CONVERSION MATH /////////////////////////

  /// @dev Queries the current total supply of underlying rebase token.
  function _query_Underlying_Supply() private view returns (uint256) {
    return _underlying.totalSupply();
  }

  /// @notice assumes underlying is decimal 18
  function _underlying_to_capped(
    uint256 underlyingAmount,
    uint256 underlyingTotalSupply
  ) private pure returns (uint256) {
    return (underlyingAmount * MAX_SUPPLY) / underlyingTotalSupply;
  }

  function _capped_to_underlying(uint256 cappedAmount, uint256 underlyingTotalSupply) private pure returns (uint256) {
    return (cappedAmount * underlyingTotalSupply) / MAX_SUPPLY;
  }

  /// @dev Internal helper function to handle deposit state change.
  /// @param from The initiator wallet.
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to deposit.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to mint.
  function _deposit(address from, address to, uint256 underlyingAmount, uint256 cappedTokenAmount) private {
    IERC20(address(_underlying)).safeTransferFrom(from, address(this), underlyingAmount);

    _mint(to, cappedTokenAmount);
  }

  /// @dev Internal helper function to handle withdraw state change.
  /// @param from The initiator wallet.
  /// @param to The beneficiary wallet.
  /// @param underlyingAmount The amount of underlyingAmount to withdraw.
  /// @param cappedTokenAmount The amount of cappedTokenAmount to burn.
  function _withdraw(address from, address to, uint256 underlyingAmount, uint256 cappedTokenAmount) private {
    _burn(from, cappedTokenAmount);

    IERC20(address(_underlying)).safeTransfer(to, underlyingAmount);
  }
}
