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
 * This relay gets a USD price for a wrapped asset from a balancer MetaStablePool
 *
 */

contract BPT_Oracle is IOracleRelay {
  using PRBMathSD59x18 for *;

  uint256 public immutable _multiply;
  uint256 public immutable _divide;

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
    uint256 mul,
    uint256 div
  ) {
    _priceFeed = IBalancerPool(pool_address);

    registerOracles(_tokens, _oracles);

    _multiply = mul;
    _divide = div;
  }

  function currentValue() external view override returns (uint256) {
    //console.log("PRICE??: ", _getLPPrice());

    console.log("Fancy Price : ", getBPTprice());

    bytes32 id = _priceFeed.getPoolId();

    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(id);

    uint256 totalValue = sumBalances(tokens, balances);
    console.log("Total value: ", totalValue);
    console.log("Total Supply: ", _priceFeed.totalSupply());
    console.log("Simple Price: ", totalValue / _priceFeed.totalSupply());
    console.log("Simple Price: ", (totalValue / _priceFeed.totalSupply()) / 1e18);

    //return totalValue / _priceFeed.totalSupply();
    return _getLPPrice();
  }

  /**
  crash plan for non weighted pools
  Get spot prices for tokens via TWAP on balancer pool itself
  because this uses the all important invariant to calculate the prices see StableOracleMath._calcSpotPrice
  or we can calc the spot price the wame way


  once we have the spot price, we can then calc the BPT price by
    //              balance X + (spot price Y/X * balance Y)                                                     //
    // BPT price = ------------------------------------------                                                    //
    //                          total supply      
   */

  /**************************************************************************************************************
        //                                                                                                           //
        //                             2.a.x.y + a.y^2 + b.y                                                         //
        // spot price Y/X = - dx/dy = -----------------------                                                        //
        //                             2.a.x.y + a.x^2 + b.x                                                         //
        //                                                                                                           //
        // n = 2                                                                                                     //
        // a = amp param * n                                                                                         //
        // b = D + a.(S - D)                                                                                         //
        // D = invariant                                                                                             //
        // S = sum of balances but x,y = 0 since x  and y are the only tokens                                        //
        **************************************************************************************************************/

  /**
   * @dev Calculates the spot price of token Y in token X.
   */
  function getSpotPrice() internal view returns (uint256 pyx) {
    (uint256 invariant, uint256 amp) = _priceFeed.getLastInvariant();
    bytes32 poolId = _priceFeed.getPoolId();

    (
      ,
      /**IERC20[] memory tokens */
      uint256[] memory balances,

    ) = VAULT.getPoolTokens(poolId);

    uint256 a = amp * 2;
    uint256 b = (invariant * a) - invariant;

    uint256 axy2 = mulDown(((a * 2) * balances[0]), balances[1]);

    // dx = a.x.y.2 + a.y^2 - b.y
    uint256 derivativeX = mulDown(axy2 + (a * balances[0]), balances[1]) - (mulDown(b, balances[1]));

    // dy = a.x.y.2 + a.x^2 - b.x
    uint256 derivativeY = mulDown(axy2 + (a * balances[0]), balances[1]) - (mulDown(b, balances[0]));

    pyx = divUp(derivativeX, derivativeY);

    console.log("PYX: ", pyx);
  }

  function getBPTprice() internal view returns (uint256 price) {
    bytes32 poolId = _priceFeed.getPoolId();

    (IERC20[] memory tokens, uint256[] memory balances, ) = VAULT.getPoolTokens(poolId);

    uint256 valueX = ((balances[0] * assetOracles[address(tokens[0])].currentValue()));

    uint256 valueY = (((getSpotPrice() * balances[1]) * assetOracles[address(tokens[1])].currentValue()) / 1e18);

    console.log("Value X: ", valueX);
    console.log("Value Y: ", valueY);

    uint256 totalValue = valueX + valueY;
    console.log("Total value: ", totalValue);

    console.log("Total Value Price: ", (totalValue / _priceFeed.totalSupply()));

    price = (totalValue / _priceFeed.totalSupply());
  }

  function _getLPPrice() internal view returns (uint256 price) {
    bytes32 poolId = _priceFeed.getPoolId();

    int256 totalSupply = int256(_priceFeed.totalSupply());
    (IERC20[] memory tokens, uint256[] memory balances, ) = VAULT.getPoolTokens(poolId);

    int256 totalPi = PRBMathSD59x18.fromInt(1e18);

    uint256[] memory prices = new uint256[](tokens.length);

    for (uint256 i = 0; i < tokens.length; i++) {
      balances[i] = (balances[i] * (10**18)) / (10**IERC20(address(tokens[i])).decimals());
      prices[i] = assetOracles[address(tokens[i])].currentValue();

      int256 val = int256(prices[i]).div(WEIGHT);
      int256 indivPi = val.pow(WEIGHT);

      totalPi = totalPi.mul(indivPi);
    }

    (
      uint256 V, /**uint256 unused */

    ) = _priceFeed.getLastInvariant();

    int256 invariant = int256(V);
    int256 numerator = totalPi.mul(invariant);
    price = uint256((numerator.toInt().div(totalSupply)));
  }

  /**
    50000 * 4 

    inv = 142788812182034023487442 142788.812182034023487442

    supply = 113210279768128923680919 113210.279768128923680919

    simple price = 1615447846318525289543 1615.447846318525289543

    inv * x 
    -------- == price
     supply

   
   
   */
  /**********************************************************************************************
  // invariant                                                                                 //
  // D = invariant                                                  D^(n+1)                    //
  // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
  // S = sum of balances                                             n^n P                     //
  // P = product of balances                                                                   //
  // n = number of tokens                                                                      //
  *********x************************************************************************************/

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
