// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

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
    uint256 curvePrice = getCurvePrice();

    //apply wOETH conversion
    uint256 priceInOeth = _priceFeed.previewDeposit(AMOUNT);

    return ((curvePrice * 1e18) / priceInOeth);
  }

  ///@notice price_oracle() returns a manipulation resistant EMA price
  function getCurvePrice() internal view returns (uint256 cPrice) {
    uint256 ethPrice = _ethOracle.currentValue();
    uint256 priceInEth = _curvePool.price_oracle();

    cPrice = ((ethPrice * 1e18) / priceInEth);
  }
}
