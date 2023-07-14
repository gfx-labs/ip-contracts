// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";

interface IBalancerPool {
  function getPoolId() external view returns (bytes32);

  function totalSupply() external view returns (uint256);

  function getLastInvariant() external view returns (uint256, uint256);

  function getRate() external view returns (uint256);
}

/*****************************************
 *
 * This relay gets a USD price for BPT LP token from a balancer MetaStablePool or StablePool
 * Utilizing the minSafePrice method, this logic should slightly undervalue the BPT
 * This method should be used as a secondary oracle in a multiple oracle system
 */

contract BPTminSafePriceRelay is IOracleRelay {
  IBalancerPool public immutable _priceFeed;
  address public immutable tokenA;
  address public immutable tokenB;

  mapping(address => IOracleRelay) public assetOracles;

  /**
   * @param pool_address - Balancer StablePool or MetaStablePool address
   * @param _tokens should be length 2 and contain both underlying assets for the pool
   * @param _oracles shoulb be length 2 and contain a safe external on-chain oracle for each @param _tokens in the same order
   * @notice the quotient of @param widthNumerator and @param widthDenominator should be the percent difference the exchange rate
   * is able to diverge from the expected exchange rate derived from just the external oracles
   */
  constructor(
    address pool_address,
    address[] memory _tokens,
    address[] memory _oracles
  ) {
    _priceFeed = IBalancerPool(pool_address);

    tokenA = _tokens[0];
    tokenB = _tokens[1];

    //register oracles
    for (uint256 i = 0; i < _tokens.length; i++) {
      assetOracles[_tokens[i]] = IOracleRelay(_oracles[i]);
    }
  }

  function currentValue() external view override returns (uint256 minSafePrice) {
    //get pMin
    uint256 p0 = assetOracles[tokenA].currentValue();
    uint256 p1 = assetOracles[tokenB].currentValue();

    uint256 max = p0 > p1 ? p0 : p1;
    uint256 min = p1 != max ? p1 : p0;

    uint256 rate = _priceFeed.getRate();

    minSafePrice = (rate * min) / 1e18;
  }
}
