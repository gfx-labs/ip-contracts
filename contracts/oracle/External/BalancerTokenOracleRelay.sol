// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "./ICurvePoolFeed.sol";
import "../../lending/IVaultController.sol";
import "../IOracleMaster.sol";

/// @title Oracle that wraps a chainlink oracle
/// @notice The oracle returns (chainlinkPrice) * mul / div
contract BalancerTokenOracleRelay is IOracleRelay {
  ICurvePoolFeed private immutable _priceFeed;
  IVaultController public constant VC = IVaultController(0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3);

  IOracleMaster public _oracle;

  uint256 public immutable _multiply;
  uint256 public immutable _divide;

  /// @notice all values set at construction time
  /// @param  feed_address address of curve feed
  /// @param mul numerator of scalar
  /// @param div denominator of scalar
  constructor(
    address feed_address,
    uint256 mul,
    uint256 div
  ) {
    _priceFeed = ICurvePoolFeed(feed_address);
    _multiply = mul;
    _divide = div;
    _oracle = IOracleMaster(VC.getOracleMaster());
  }

  /// @notice the current reported value of the oracle
  /// @return the current value
  /// @dev implementation in getLastSecond
  function currentValue() external view override returns (uint256) {
    return getLastSecond();
  }

  ///@notice get the price in USD terms, after having converted from ETH terms
  function getLastSecond() private view returns (uint256) {

    (uint256 currentPrice, bool isSafe) = _priceFeed.current_price();
    require(isSafe, "Curve Oracle: Not Safe");

    uint256 ethPrice = _oracle.getLivePrice(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    currentPrice = (currentPrice * ethPrice) / 1e18;


    require(currentPrice > 0, "Curve: px < 0");
    uint256 scaled = (uint256(currentPrice) * _multiply) / _divide;
    return scaled;
  }
}
