// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";

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

  function getRate() external view returns (uint256);

  function getPoolId() external view returns (bytes32);

  function getLastInvariant() external view returns (uint256, uint256);
}

/*****************************************
 *
 * This relay gets a USD price for a pegged asset from a balancer StablePool
 * Price is calculated using a known safe price for one asset in the pool to derive the price for the other via the exchange rate
 * The exchange rate is calculated using the invariant, thereby making the derived price resistant to manipulation
 *
 * This should be used as one of two separate relays for a token price where possible, such that a second safe price
 * is obtained elsewhere to serve as a check via AnchorViewRelay
 *
 */

contract BalancerStablePoolTokenOracle is IOracleRelay {
  IBalancerFeed private immutable _priceFeed;
  IBalancerVault public constant VAULT = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
  bytes32 public immutable _poolId;

  IOracleRelay public immutable knownTokenOracle;
  address public immutable knownToken;

  /**
   * @param pool_address - Balancer stablePool address
   * @param _tokenB - address of the token whose price is known
   * @param _oracleB - address of the oracle relay for the known safe price for the known token
   */
  constructor(address pool_address, address _tokenB, address _oracleB) {
    _priceFeed = IBalancerFeed(pool_address);
    _poolId = _priceFeed.getPoolId();

    knownTokenOracle = IOracleRelay(_oracleB);
    knownToken = _tokenB;
  }

  function currentValue() external view override returns (uint256) {
    (
      ,
      /**IERC20[] memory tokens */
      uint256[] memory balances /**uint256 lastChangeBlock */,

    ) = VAULT.getPoolTokens(_poolId);
    uint256 pyx = getSpotPrice(balances);

    return (pyx * knownTokenOracle.currentValue()) / 1e18;
  }

  /**
   * @dev Calculates the spot price of token Y in terms of token X.
   */
  function getSpotPrice(uint256[] memory balances) internal view returns (uint256 pyx) {
    (uint256 invariant, uint256 amp) = _priceFeed.getLastInvariant();

    uint256 a = amp * 2;
    uint256 b = (invariant * a) - invariant;

    uint256 axy2 = mulDown(((a * 2) * balances[0]), balances[1]);

    // dx = a.x.y.2 + a.y^2 - b.y
    uint256 derivativeX = mulDown(axy2 + (a * balances[0]), balances[1]) - (mulDown(b, balances[1]));

    // dy = a.x.y.2 + a.x^2 - b.x
    uint256 derivativeY = mulDown(axy2 + (a * balances[0]), balances[1]) - (mulDown(b, balances[0]));

    pyx = divUp(derivativeX, derivativeY);
  }

  function mulDown(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 product = a * b;
    require(a == 0 || product / a == b, "overflow");

    return product / 1e18;
  }

  function divUp(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, "Zero Division");

    if (a == 0) {
      return 0;
    } else {
      uint256 aInflated = a * 1e18;
      require(aInflated / a == 1e18, "divUp error - mull overflow"); // mul overflow

      // The traditional divUp formula is:
      // divUp(x, y) := (x + y - 1) / y
      // To avoid intermediate overflow in the addition, we distribute the division and get:
      // divUp(x, y) := (x - 1) / y + 1
      // Note that this requires x != 0, which we already tested for.

      return ((aInflated - 1) / b) + 1;
    }
  }
  
}
