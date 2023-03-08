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
 * This relay gets a USD price for BPT LP token from a balancer MetaStablePool
 * This can be used as a stand alone oracle as the price is checked 2 separate ways
 *
 */

contract BPT_Oracle is IOracleRelay {
  using PRBMathSD59x18 for *;

  bytes32 public immutable _poolId;

  uint256 public immutable _widthNumerator;
  uint256 public immutable _widthDenominator;

  IBalancerPool public immutable _priceFeed;

  mapping(address => IOracleRelay) public assetOracles;

  //Balancer Vault
  IBalancerVault public immutable VAULT; // = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

  /**
   * @param pool_address - Balancer StablePool or MetaStablePool address
   */
  constructor(
    address pool_address,
    IBalancerVault balancerVault,
    address[] memory _tokens,
    address[] memory _oracles,
    uint256 widthNumerator,
    uint256 widthDenominator
  ) {
    _priceFeed = IBalancerPool(pool_address);

    _poolId = _priceFeed.getPoolId();

    VAULT = balancerVault;

    registerOracles(_tokens, _oracles);

    _widthNumerator = widthNumerator;
    _widthDenominator = widthDenominator;
  }

  function currentValue() external view override returns (uint256) {
    (
      IERC20[] memory tokens,
      uint256[] memory balances, /**uint256 lastChangeBlock */

    ) = VAULT.getPoolTokens(_poolId);
    invariantFormula(tokens, balances);

    uint256 simpleValue = sumBalances(tokens, balances);
    uint256 simplePrice = simpleValue / _priceFeed.totalSupply();
    require(simplePrice > 0, "invalid simple price");

    uint256 robustPrice = getBPTprice(tokens, balances);
    console.log("Robust price: ", robustPrice);
    console.log("simple price: ", simplePrice);

    require(robustPrice > 0, "invalid robust price");

    // calculate buffer
    uint256 buffer = (_widthNumerator * simplePrice) / _widthDenominator;

    // create upper and lower bounds
    uint256 upperBounds = simplePrice + buffer;
    uint256 lowerBounds = simplePrice - buffer;

    //console.log("Simple Price: ", simplePrice, simplePrice / 1e18);
    //console.log("Robust Price: ", robustPrice, robustPrice / 1e18);

    // ensure the robust price is within bounds
    require(robustPrice < upperBounds, "robustPrice too low");
    require(robustPrice > lowerBounds, "robustPrice too high");

    // return checked price
    return robustPrice;
  }

  //                             2.a.x.y + a.y^2 + b.y                                                         //
  // spot price Y/X = - dx/dy = -----------------------                                                        //
  //                             2.a.x.y + a.x^2 + b.x                                                         //
  //                                                                                                           //
  // n = 2                                                                                                     //
  // a = amp param * n                                                                                         //
  // b = D + a.(S - D)                                                                                         //
  // D = invariant                                                                                             //
  // S = sum of balances but x,y = 0 since x  and y are the only tokens                                        //

  // once we have the spot price, we can then calc the BPT price by
  //              balance X + (spot price Y/X * balance Y)                                                     //
  // BPT price = ------------------------------------------                                                    //
  //                          total supply

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

    uint256 pyx = getSpotPrice(balances);
    uint256[] memory reverse = new uint256[](2);
    reverse[0] = balances[1];
    reverse[1] = balances[0];

    uint256 pxy = getSpotPrice(reverse);

    //uint256 valueX = ((balances[0] * assetOracles[address(tokens[0])].currentValue()));
    uint256 valueX = (((pxy * balances[0]) * assetOracles[address(tokens[0])].currentValue()) / 1e18);

    uint256 valueY = (((pyx * balances[1]) * assetOracles[address(tokens[1])].currentValue()) / 1e18);

    uint256 totalValue = valueX + valueY;

    price = (totalValue / _priceFeed.totalSupply());

    //uniStyle(assetOracles[address(tokens[0])].currentValue(), assetOracles[address(tokens[1])].currentValue());
  }

  function invariantFormula(IERC20[] memory tokens, uint256[] memory balances) internal view {
    //int256 weightModifier = int256(1e18) / (int256(5e17).pow(int256(5e17)) * 2);
    (uint256 invariant, uint256 amp) = _priceFeed.getLastInvariant();
    uint256 a = amp * 2;
    uint256 V = (invariant * a) - invariant;

    uint256 K = V / a;

  /*
  console.log("Invariant: ", invariant);
  console.log("AMP: ", amp, a);
  console.log("Amplified: ", V);
  console.log("Testing??: ", K);
  */

  /**

  For all: 

  Closest to simple: K 
  invariant onl  1807445808749031612880 1807.44580874903161288
  INV utilize K  1807427734290944122563 1807.427734290944122563
  Robust price:  1716542781054602544033 1716.542781054602544033
  simple price:  1716542740177402721733 1716.542740177402721733
  Deviation from simple price: 5.294653723806986%

  Closest to simple: K 
  invariant onl  1759991645857842864514 1759.991645857842864514
  INV utilize K  1759974045941384286086 1759.974045941384286086
  Robust price:  1709353293223869510514 1709.353293223869510514
  simple price:  1709351161866984898973 1709.351161866984898973
  Deviation from simple price: 2.961526291596399%

  Closest to simple: INV
  invariant onl  18291087272096805490   18.29108727209680549
  INV utilize K  18290904361224084522   18.290904361224084522
  Robust price:  18326395901812910110   18.326395901812910110
  simple price:  18326395901725071798   18.326395901725071798
  Deviation from simple price: -0.19266543%

  */

    int256 totalPi = PRBMathSD59x18.fromInt(1e18);

    uint256[] memory prices = new uint256[](tokens.length);

    for (uint256 i = 0; i < tokens.length; i++) {
      balances[i] = (balances[i] * (10**18)) / (10**IERC20(address(tokens[i])).decimals());
      prices[i] = assetOracles[address(tokens[i])].currentValue();

      int256 val = int256(prices[i]).div(int256(5e17));

      int256 indivPi = val.pow(int256(5e17));
      console.log("Indv Pi: ", uint256(indivPi));

      totalPi = totalPi.mul(indivPi);
    }

    int256 numerator = (totalPi.mul(int256(V))).div(int256(1e18));
    uint256 price = uint256((numerator.toInt().div(int256(_priceFeed.totalSupply()))));

    console.log("INV utilize K ", price / 2);
  }

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
