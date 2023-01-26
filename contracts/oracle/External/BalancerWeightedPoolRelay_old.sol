// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";

//import "@prb/math/src/SD59x18.sol";

import "hardhat/console.sol";

interface IBalancerPool {
  function getPoolId() external view returns (bytes32);

  function getNormalizedWeights() external view returns (uint256[] memory);

  function totalSupply() external view returns (uint256);

  function getLastInvariant() external view returns (uint256, uint256);
}

/*****************************************
 *
 * This relay gets a USD price for a wrapped asset from a balancer MetaStablePool
 *
 */

contract BalancerWeightedPoolRelay is IOracleRelay {
  //using PRBMathSD59x18 for *;

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
  constructor(address pool_address, address[] memory _tokens, address[] memory _oracles, uint256 mul, uint256 div) {
    _priceFeed = IBalancerPool(pool_address);

    registerOracles(_tokens, _oracles);

    _multiply = mul;
    _divide = div;
  }

  function currentValue() external view override returns (uint256) {
    uint256 bptPrice = _getBPTprice(true);

    bytes32 id = _priceFeed.getPoolId();

    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(id);

    uint256 totalValue = sumBalances(tokens, balances);

    return totalValue / _priceFeed.totalSupply();
  }

  function _getBPTprice(bool safe) internal view returns (uint256 price) {
    bytes32 poolId = _priceFeed.getPoolId();
    console.log("Got Pool ID");
    uint256[] memory weights = new uint256[](2); //_priceFeed.getNormalizedWeights();
    weights[0] = uint256(5e17);
    weights[1] = uint256(5e17);
    console.log("Got weights");
    uint256 totalSupply = _priceFeed.totalSupply();
    console.log("Got weights");

    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(poolId);
    console.log("Got pool tokens");
  }

  function sumBalances(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 total) {
    total = 0;

    //console.log("Balances: ", balances.length);
    //console.log("token: ", address(tokens[0]), "balance: ", balances[0]); //100615514.12233347 USD
    //console.log("token: ", address(tokens[1]), "balance: ", balances[1]); //79835218.30133966 USD += 180,450,732.4233397 USD??

    for (uint256 i = 0; i < tokens.length; i++) {
      total += ((assetOracles[address(tokens[i])].currentValue() * balances[i]));
      console.log(address(tokens[i]), assetOracles[address(tokens[i])].currentValue());
    }
  }

  function registerOracles(address[] memory _tokens, address[] memory _oracles) internal {
    for (uint256 i = 0; i < _tokens.length; i++) {
      assetOracles[_tokens[i]] = IOracleRelay(_oracles[i]);
    }
  }
}
