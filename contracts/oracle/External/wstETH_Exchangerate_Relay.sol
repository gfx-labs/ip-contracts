// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IVault.sol";

interface IBalancerPool {
  function getPoolID() external view returns (bytes32);

  function totalSupply() external view returns (uint256);
}

/*****************************************
 *
 * This relay gets a USD price for a wrapped asset from a balancer MetaStablePool
 *
 */

contract BPT_TWAP_Oracle is IOracleRelay {
  uint256 public immutable _multiply;
  uint256 public immutable _divide;

  IBalancerPool private immutable _priceFeed;
  IOracleRelay public constant ethOracle = IOracleRelay(0x22B01826063564CBe01Ef47B96d623b739F82Bf2);

  mapping(address => IOracleRelay) public assetOracles;

  //Balancer Vault
  IVault public constant VAULT = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

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
    (
      IERC20[] memory tokens,
      uint256[] memory balances, /**uint256 lastChangeBlock */

    ) = VAULT.getPoolTokens(_priceFeed.getPoolID());

    uint256 totalValue = sumBalances(tokens, balances);

    return totalValue / _priceFeed.totalSupply();
  }

  function sumBalances(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 total) {
    total = 0;
    for (uint256 i = 0; i < tokens.length; i++) {
      total += assetOracles[address(tokens[i])].currentValue() * balances[i];
    }
  }

  function registerOracles(address[] memory _tokens, address[] memory _oracles) internal {
    for (uint256 i = 0; i < _tokens.length; i++) {
      assetOracles[_tokens[i]] = IOracleRelay(_oracles[i]);
    }
  }
}
