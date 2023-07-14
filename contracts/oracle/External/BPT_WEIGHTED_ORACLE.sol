// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/PRBMath/PRBMathSD59x18.sol";

/*****************************************
 *
 * This relay gets a USD price for a Balancer BPT LP token from a weighted pool
 *
 */

interface IBalancerPool {
  function totalSupply() external view returns (uint256);

  function getLastInvariant() external view returns (uint256);

  function getNormalizedWeights() external view returns (uint256[] memory);
}

contract BPT_WEIGHTED_ORACLE is IOracleRelay {
  using PRBMathSD59x18 for *;

  IBalancerPool public immutable _priceFeed;
  mapping(address => IOracleRelay) public _assetOracles;
  address[] public _tokens;

  /**
   * @param priceFeed - Balancer weighted pool address
   * @param tokens order must match the corrisponding weights of getNormalizedWeights()
   * @param oracles must be in the same order as @param tokens
   */
  constructor(IBalancerPool priceFeed, address[] memory tokens, address[] memory oracles) {
    _priceFeed = priceFeed;
    _tokens = tokens;

    //register oracles
    for (uint256 i = 0; i < _tokens.length; i++) {
      _assetOracles[tokens[i]] = IOracleRelay(oracles[i]);
    }
  }

  function currentValue() external view override returns (uint256) {
    uint256[] memory weights = _priceFeed.getNormalizedWeights();

    int256 totalPi = PRBMathSD59x18.fromInt(1e18);

    uint256[] memory prices = new uint256[](_tokens.length);

    for (uint256 i = 0; i < _tokens.length; i++) {
      prices[i] = _assetOracles[_tokens[i]].currentValue();

      int256 val = int256(prices[i]).div(int256(weights[i]));

      int256 indivPi = val.pow(int256(weights[i]));

      totalPi = totalPi.mul(indivPi);
    }

    int256 invariant = int256(_priceFeed.getLastInvariant());
    int256 numerator = totalPi.mul(invariant);
    return uint256((numerator.toInt().div(int256(_priceFeed.totalSupply()))));
  }
}
