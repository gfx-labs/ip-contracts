// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

import "hardhat/console.sol";

interface IrEethOracleFeed {
  function getEthValue(uint256 _rethAmount) external view returns (uint256);
}

contract OracleRETH is IOracleRelay {
  

  IrEethOracleFeed public constant _priceFeed = IrEethOracleFeed(0xae78736Cd615f374D3085123A210448E74Fc6393);
  IOracleRelay public constant ethOracle = IOracleRelay(0x22B01826063564CBe01Ef47B96d623b739F82Bf2);

  function currentValue() external view override returns (uint256) {
    uint256 priceInEth = getLastSecond();
    uint256 ethPrice = ethOracle.currentValue();

    ///ethPrice to assets per 1 eth
    //      return divide(ethPrice, priceInEth, 18);

    //console.log("INVERT == false");
    ///ethPrice to eth per 1 asset
    return (ethPrice * priceInEth) / 1e18;
  }

  /**
    eth is 1000
    price in eth is 250 - implies 250 eth per thing but actually is things per eth
   */

  function getLastSecond() private view returns (uint256) {
    return _priceFeed.getEthValue(1e18);
  }

  /**
  function divide(
    uint256 numerator,
    uint256 denominator,
    uint256 factor
  ) internal pure returns (uint256) {
    uint256 q = (numerator / denominator) * 10**factor;
    uint256 r = ((numerator * 10**factor) / denominator) % 10**factor;

    return q + r;
  }
   */
}
