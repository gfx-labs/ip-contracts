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

  function getLastInvariant() external view returns (uint256, uint256);
}

/*****************************************
 *
 * This relay gets a USD price for BPT LP token from a balancer MetaStablePool *
 *
 */

contract BPT_Oracle is IOracleRelay {
  using PRBMathSD59x18 for *;

  bytes32 public immutable _poolId;

  uint256 public immutable _widthNumerator;
  uint256 public immutable _widthDenominator;

  IBalancerPool private immutable _priceFeed;
  IOracleRelay public constant ethOracle = IOracleRelay(0x22B01826063564CBe01Ef47B96d623b739F82Bf2);

  mapping(address => IOracleRelay) public assetOracles;

  //Balancer Vault
  IBalancerVault public constant VAULT = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

  int256 public constant WEIGHT = int256(5e17);

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

    _poolId = _priceFeed.getPoolId();

    registerOracles(_tokens, _oracles);

    _widthNumerator = widthNumerator;
    _widthDenominator = widthDenominator;
  }

  function currentValue() external view override returns (uint256) {
    (
      IERC20[] memory tokens,
      uint256[] memory balances, /**uint256 lastChangeBlock */

    ) = VAULT.getPoolTokens(_poolId);

    uint256 simpleValue = sumBalances(tokens, balances);
    uint256 simplePrice = simpleValue / _priceFeed.totalSupply();
    require(simplePrice > 0, "invalid simple price");

    uint256 robustPrice = getBPTprice(tokens, balances);
    require(robustPrice > 0, "invalid robust price");

    // calculate buffer
    uint256 buffer = (_widthNumerator * simplePrice) / _widthDenominator;

    // create upper and lower bounds
    uint256 upperBounds = simplePrice + buffer;
    uint256 lowerBounds = simplePrice - buffer;

    console.log("Simple Price: ", simplePrice, simplePrice / 1e18);
    console.log("Robust Price: ", robustPrice, robustPrice / 1e18);

    // ensure the robust price is within bounds
    require(robustPrice < upperBounds, "robustPrice too low");
    require(robustPrice > lowerBounds, "robustPrice too high");

    // return checked price
    return robustPrice;
  }

  /**
    //                             2.a.x.y + a.y^2 + b.y                                                         //
    // spot price Y/X = - dx/dy = -----------------------                                                        //
    //                             2.a.x.y + a.x^2 + b.x                                                         //
    //                                                                                                           //
    // n = 2                                                                                                     //
    // a = amp param * n                                                                                         //
    // b = D + a.(S - D)                                                                                         //
    // D = invariant                                                                                             //
    // S = sum of balances but x,y = 0 since x  and y are the only tokens                                        //

  once we have the spot price, we can then calc the BPT price by
    //              balance X + (spot price Y/X * balance Y)                                                     //
    // BPT price = ------------------------------------------                                                    //
    //                          total supply      
   */

  /**
   * @dev Calculates the spot price of token Y in terms of token X.
   todo optimize for getPoolTokens calls? 
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

  //The below formula is used for converting balances => invariant by the Balancer protocol
  /**********************************************************************************************
  // invariant                                                                                 //
  // D = invariant                                                  D^(n+1)                    //
  // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
  // S = sum of balances                                             n^n P                     //
  // P = product of balances                                                                   //
  // n = number of tokens                                                                      //
  *********x************************************************************************************/
  function getBPTprice(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 price) {
    //(IERC20[] memory tokens, uint256[] memory balances, ) = VAULT.getPoolTokens(poolId);

    uint256 valueX = ((balances[0] * assetOracles[address(tokens[0])].currentValue()));

    uint256 valueY = (((getSpotPrice(balances) * balances[1]) * assetOracles[address(tokens[1])].currentValue()) /
      1e18);

    uint256 totalValue = valueX + valueY;

    price = (totalValue / _priceFeed.totalSupply());
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
