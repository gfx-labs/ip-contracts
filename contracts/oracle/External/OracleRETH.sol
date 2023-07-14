// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

interface IrEethOracleFeed {
  function getEthValue(uint256 _rethAmount) external view returns (uint256);
}

contract OracleRETH is IOracleRelay {
  IrEethOracleFeed public constant _priceFeed = IrEethOracleFeed(0xae78736Cd615f374D3085123A210448E74Fc6393);
  IOracleRelay public constant ethOracle = IOracleRelay(0x22B01826063564CBe01Ef47B96d623b739F82Bf2);

  function currentValue() external view override returns (uint256) {
    uint256 priceInEth = getLastSecond();
    uint256 ethPrice = ethOracle.currentValue();

    return (ethPrice * priceInEth) / 1e18;
  }

  function getLastSecond() private view returns (uint256) {
    return _priceFeed.getEthValue(1e18);
  }
}
