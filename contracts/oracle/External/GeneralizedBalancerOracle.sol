// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

interface IBalancerFeed {
  enum Variable {
    PAIR_PRICE,
    BPT_PRICE,
    INVARIANT
  }

  struct OracleAverageQuery {
    Variable variable;
    uint256 secs;
    uint256 ago;
  }

  function getTimeWeightedAverage(OracleAverageQuery[] memory queries) external view returns (uint256[] memory);
}

contract GeneralizedBalancerOracle is IOracleRelay {
  uint256 public immutable _multiply;
  uint256 public immutable _divide;
  uint256 public immutable _secs;

  IBalancerFeed private immutable _priceFeed;
  IOracleRelay public constant ethOracle = IOracleRelay(0x22B01826063564CBe01Ef47B96d623b739F82Bf2);

  constructor(
    uint32 lookback,
    address pool_address,
    uint256 mul,
    uint256 div
  ) {
    _priceFeed = IBalancerFeed(pool_address);
    _multiply = mul;
    _divide = div;
    _secs = lookback;
  }

  function currentValue() external view override returns (uint256) {
    uint256 priceInEth = getLastSecond();
    uint256 ethPrice = ethOracle.currentValue();

    return (ethPrice * priceInEth) / 1e18;
  }

  function getLastSecond() private view returns (uint256) {
    IBalancerFeed.OracleAverageQuery[] memory inputs = new IBalancerFeed.OracleAverageQuery[](1);

    inputs[0] = IBalancerFeed.OracleAverageQuery({variable: IBalancerFeed.Variable.PAIR_PRICE, secs: _secs, ago: 0});

    return _priceFeed.getTimeWeightedAverage(inputs)[0];
  }
}
