// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";

import "../../_external/PRBMath/PRBMathSD59x18.sol";


interface IBalancerPool {
  function getPoolId() external view returns (bytes32);

  function totalSupply() external view returns (uint256);

  function getLastInvariant() external view returns (uint256);

  function getNormalizedWeights() external view returns (uint256[] memory);
}

/*****************************************
 *
 * This relay gets a USD price for a Balancer BPT LP token from a weighted pool
 *
 */

contract BPT_WEIGHTED_ORACLE is IOracleRelay {
  using PRBMathSD59x18 for *;

  bytes32 public immutable _poolId;

  uint256 public immutable _widthNumerator;
  uint256 public immutable _widthDenominator;

  IBalancerPool private immutable _priceFeed;
  IOracleRelay public constant ethOracle = IOracleRelay(0x22B01826063564CBe01Ef47B96d623b739F82Bf2);

  mapping(address => IOracleRelay) public assetOracles;

  //Balancer Vault
  IBalancerVault public constant VAULT = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

  /**
   * @param pool_address - Balancer pool address
   */
  constructor(
    address pool_address,
    address[] memory _tokens,
    address[] memory _oracles,
    uint256 widthNumerator,
    uint256 widthDenominator
  ) {
    _priceFeed = IBalancerPool(pool_address);

    registerOracles(_tokens, _oracles);

    _widthNumerator = widthNumerator;
    _widthDenominator = widthDenominator;
    _poolId = _priceFeed.getPoolId();
  }

  function currentValue() external view override returns (uint256) {
    (
      IERC20[] memory tokens,
      uint256[] memory balances, /**uint256 lastChangeBlock */

    ) = VAULT.getPoolTokens(_poolId);
    uint256 robustPrice = getBPTprice(tokens, balances, int256(_priceFeed.totalSupply()));
    require(robustPrice > 0, "invalid robust price");

    uint256 simplePrice = sumBalances(tokens, balances) / _priceFeed.totalSupply();
    require(simplePrice > 0, "invalid simple price");

    // calculate buffer
    uint256 buffer = (_widthNumerator * simplePrice) / _widthDenominator;

    // create upper and lower bounds
    uint256 upperBounds = simplePrice + buffer;
    uint256 lowerBounds = simplePrice - buffer;

    // ensure the robust price is within bounds
    require(robustPrice < upperBounds, "robustPrice too low");
    require(robustPrice > lowerBounds, "robustPrice too high");

    // return checked price
    return robustPrice;
  }

  function getBPTprice(
    IERC20[] memory tokens,
    uint256[] memory balances,
    int256 totalSupply
  ) internal view returns (uint256 price) {
    uint256[] memory weights = _priceFeed.getNormalizedWeights();

    int256 totalPi = PRBMathSD59x18.fromInt(1e18);

    uint256[] memory prices = new uint256[](tokens.length);

    for (uint256 i = 0; i < tokens.length; i++) {
      balances[i] = (balances[i] * (10**18)) / (10**IERC20(address(tokens[i])).decimals());
      prices[i] = assetOracles[address(tokens[i])].currentValue();

      int256 val = int256(prices[i]).div(int256(weights[i]));

      int256 indivPi = val.pow(int256(weights[i]));

      totalPi = totalPi.mul(indivPi);
    }

    int256 invariant = int256(_priceFeed.getLastInvariant());
    int256 numerator = totalPi.mul(invariant);
    price = uint256((numerator.toInt().div(totalSupply)));
  }

  ///@notice get total values for calculating the simple price
  function sumBalances(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 total) {
    total = 0;
    for (uint256 i = 0; i < tokens.length; i++) {
      total += ((assetOracles[address(tokens[i])].currentValue() * balances[i]));
    }
  }

  function registerOracles(address[] memory _tokens, address[] memory _oracles) internal {
    for (uint256 i = 0; i < _tokens.length; i++) {
      assetOracles[_tokens[i]] = IOracleRelay(_oracles[i]);
    }
  }
}
