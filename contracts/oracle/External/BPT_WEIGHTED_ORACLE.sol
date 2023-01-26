// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";

import "../../_external/PRBMath/PRBMathSD59x18.sol";

import "hardhat/console.sol";

interface IBalancerPool {
  function getPoolId() external view returns (bytes32);

  function totalSupply() external view returns (uint256);

  function getLastInvariant() external view returns (uint256);

  function getNormalizedWeights() external view returns (uint256[] memory);
}

/*****************************************
 *
 * This relay gets a USD price for a wrapped asset from a balancer MetaStablePool
 *
 */

contract BPT_WEIGHTED_ORACLE is IOracleRelay {
  using PRBMathSD59x18 for *;

  uint256 public immutable _multiply;
  uint256 public immutable _divide;

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
    uint256 mul,
    uint256 div
  ) {
    _priceFeed = IBalancerPool(pool_address);

    registerOracles(_tokens, _oracles);

    _multiply = mul;
    _divide = div;
  }

  function currentValue() external view override returns (uint256) {
    console.log("PRICE??: ", _getLPPrice());

    bytes32 id = _priceFeed.getPoolId();

    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(id);

    uint256 totalValue = sumBalances(tokens, balances);
    console.log("Simple Price: ", totalValue / _priceFeed.totalSupply());

    //return totalValue / _priceFeed.totalSupply();
    return _getLPPrice();
  }

  function _getLPPrice() internal view returns (uint256 price) {
    bytes32 poolId = _priceFeed.getPoolId();
    uint256[] memory weights = _priceFeed.getNormalizedWeights();

    int256 totalSupply = int256(_priceFeed.totalSupply());
    (IERC20[] memory tokens, uint256[] memory balances, ) = VAULT.getPoolTokens(poolId);

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

  function sumBalances(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 total) {
    total = 0;

    //console.log("Balances: ", balances.length);
    //console.log("token: ", address(tokens[0]), "balance: ", balances[0]); //100615514.12233347 USD
    //console.log("token: ", address(tokens[1]), "balance: ", balances[1]); //79835218.30133966 USD += 180,450,732.4233397 USD??

    for (uint256 i = 0; i < tokens.length; i++) {
      total += ((assetOracles[address(tokens[i])].currentValue() * balances[i]));
      //console.log(address(tokens[i]), assetOracles[address(tokens[i])].currentValue());
    }
  }

  function registerOracles(address[] memory _tokens, address[] memory _oracles) internal {
    for (uint256 i = 0; i < _tokens.length; i++) {
      assetOracles[_tokens[i]] = IOracleRelay(_oracles[i]);
    }
  }
}
