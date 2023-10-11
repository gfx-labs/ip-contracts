// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

//testing
import "hardhat/console.sol";

/*****************************************
 * This gets USD price on Optimism based on the exchange rate
 * found on the RocketOvmPriceOracle @ 0x1a8F81c256aee9C640e14bB0453ce247ea0DFE6F
 * This is a price ported from mainnet and should not be used as a primary oracle on Optimism
 */
interface IWOETH {
  function previewDeposit(uint256 assets) external view returns (uint256 shares);
}

interface ICurvePool {
  function price_oracle() external view returns (uint256);
}

/**

If OETH is ~= to ETH
And we have an orcle for OETH already

Convert ETH to wOETH price, wOETH price should be gt ETH price
wOETH amount should be lt OETH amount

use preview deposit
I give 1 OETH and get x wOETH



 */

contract wOETH_ORACLE is IOracleRelay {
  IWOETH public immutable _priceFeed;
  IOracleRelay public immutable _ethOracle;
  ICurvePool public immutable _curvePool;

  uint256 private constant AMOUNT = 1e18;

  ///@param priceFeed should be the wOETH addr
  constructor(ICurvePool curvePool, IWOETH priceFeed, IOracleRelay ethOracle) {
    _priceFeed = priceFeed;
    _ethOracle = ethOracle;
    _curvePool = curvePool;
  }

  function currentValue() external view override returns (uint256) {
    console.log("Curve price: ", getCurvePrice());

    uint256 curvePrice = getCurvePrice();
    uint256 ethPrice = _ethOracle.currentValue();
    compare(ethPrice, curvePrice);
    //confirm ethPrice and curvePrice are sufficiently close to eachother

    uint256 priceInOeth = _priceFeed.previewDeposit(AMOUNT);

    return ((curvePrice * 1e18) / priceInOeth);

    /**
    uint256 priceInEth = _priceFeed.rate();
    uint256 ethPrice = _ethOracle.currentValue();

    return (ethPrice * priceInEth) / 1e18;
     */
  }

  function compare(uint256 ethPrice, uint256 curvePrice) internal pure {
    uint256 buffer = 10000000000000000; //1%

    ethPrice > curvePrice
      ? require(ethPrice - curvePrice > buffer, "curvePrice too low")
      : require(curvePrice - ethPrice > buffer, "curvePrice too high");
  }

  function getCurvePrice() internal view returns (uint256 cPrice) {
    uint256 ethPrice = _ethOracle.currentValue();
    uint256 priceInEth = _curvePool.price_oracle();

    cPrice = ((ethPrice * 1e18) / priceInEth);
  }
}
