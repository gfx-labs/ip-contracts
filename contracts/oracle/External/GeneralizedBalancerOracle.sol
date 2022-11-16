// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";

import "hardhat/console.sol";

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
  bool public immutable _invert;

  IBalancerFeed private immutable _priceFeed;
  IOracleRelay public constant ethOracle = IOracleRelay(0x22B01826063564CBe01Ef47B96d623b739F82Bf2);

  constructor(
    uint32 lookback,
    address pool_address,
    bool invert,
    uint256 mul,
    uint256 div
  ) {
    _priceFeed = IBalancerFeed(pool_address);
    _multiply = mul;
    _divide = div;
    _secs = lookback;

    _invert = invert;
  }

  function currentValue() external view override returns (uint256) {
    uint256 priceInEth = getLastSecond();
    uint256 ethPrice = ethOracle.currentValue();


    ///ethPrice to assets per 1 eth
    if (_invert) {
      //console.log("INVERT == true");
      return divide(ethPrice, priceInEth, 18);
    }

    //console.log("INVERT == false");
    ///ethPrice to eth per 1 asset
    return (ethPrice * priceInEth) / 1e18;
  }

  /**
    eth is 1000
    price in eth is 250 - implies 250 eth per thing but actually is things per eth
   */

  function getLastSecond() private view returns (uint256) {
    IBalancerFeed.OracleAverageQuery[] memory inputs = new IBalancerFeed.OracleAverageQuery[](1);

    inputs[0] = IBalancerFeed.OracleAverageQuery({
      variable: IBalancerFeed.Variable.PAIR_PRICE,
      secs: _secs,
      ago: _secs
    });

    uint256 result = _priceFeed.getTimeWeightedAverage(inputs)[0];

    //console.log("RAW PRICE IN ETH : ", result);
    //console.log("ADJ PRICE IN ETH : ", (result / 1e18));

    return result;
  }

  function divide(
    uint256 numerator,
    uint256 denominator,
    uint256 factor
  ) internal pure returns (uint256) {
    uint256 q = (numerator / denominator) * 10**factor;
    uint256 r = ((numerator * 10**factor) / denominator) % 10**factor;

    return q + r;
  }
}

