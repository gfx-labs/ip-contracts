// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";
import "../../_external/balancer/LogExpMath.sol";

import "./IBaseOracle.sol";
import "./UsingBaseOracle.sol";
import "./HomoraMath.sol";

import "hardhat/console.sol";

interface IBalancerPool {
  function getPoolId() external view returns (bytes32);

  function totalSupply() external view returns (uint256);

  function getLastInvariant() external view returns (uint256, uint256);

  function getRate() external view returns (uint256);

  //metaStablePool only
  function getOracleMiscData()
    external
    view
    returns (
      int256 logInvariant,
      int256 logTotalSupply,
      uint256 oracleSampleCreationTimestamp,
      uint256 oracleIndex,
      bool oracleEnabled
    );
}

/*****************************************
 *
 * This relay gets a USD price for BPT LP token from a balancer MetaStablePool
 * This can be used as a stand alone oracle as the price is checked 2 separate ways
 *
 */

contract BPTstablePoolOracle is IOracleRelay {
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
    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(_poolId);

    checkLastChangedBlock(lastChangeBlock);

    uint256 naivePrice = getNaivePrice(tokens, balances);
    uint256 robustPrice = calcBptOut(tokens, balances);
    
    verifyNaivePrice(naivePrice, robustPrice);

    return naivePrice;
  }

  /*******************************GET & CHECK NAIVE PRICE********************************/
  function getNaivePrice(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 naivePrice) {
    uint256 naiveValue = sumBalances(tokens, balances);
    naivePrice = naiveValue / _priceFeed.totalSupply();
    require(naivePrice > 0, "invalid naive price");
  }

  function verifyNaivePrice(uint256 naivePrice, uint256 robustPrice) internal view {
    require(robustPrice > 0, "invalid robust price"); //todo move this to the used robust price

    // calculate buffer
    uint256 buffer = (_widthNumerator * naivePrice) / _widthDenominator;

    // create upper and lower bounds
    uint256 upperBounds = naivePrice + buffer;
    uint256 lowerBounds = naivePrice - buffer;

    ////console.log("naive Price: ", naivePrice, naivePrice / 1e18);
    ////console.log("Robust Price: ", robustPrice, robustPrice / 1e18);

    // ensure the robust price is within bounds
    require(robustPrice < upperBounds, "robustPrice too low");
    require(robustPrice > lowerBounds, "robustPrice too high");
  }

  /*******************************CHECK FOR LAST CHANGE BLOCK********************************/
  function checkLastChangedBlock(uint256 lastChangeBlock) internal view {
    require(lastChangeBlock < block.number, "Revert for manipulation resistance");
  }

  /*******************************CALCULATE BPT OUT********************************/

  function calcBptOut(IERC20[] memory tokens, uint256[] memory _balances) internal view returns (uint256 output) {
    (, /**uint256 v */ uint256 amp) = _priceFeed.getLastInvariant();

    uint256 currentV = _calculateInvariant(amp, _balances);
    uint256 factor = 20;

    //console.log("Bal0: ", _balances[0]);
    //console.log("Bal1: ", _balances[1]);

    _balances[0] = _balances[0] + 10 ** factor;
    _balances[1] = _balances[1] + 10 ** factor;

    //console.log("Amt0: ", _balances[0]);
    //console.log("Amt1: ", _balances[1]);

    uint256 newInvariant = _calculateInvariant(amp, _balances);

    uint256 invariantRatio = divide(newInvariant, currentV, 18);

    uint256 result = mulDown(_priceFeed.totalSupply(), (invariantRatio - 1e18));

    //price0 + price1
    uint256 numerator = assetOracles[address(tokens[0])].currentValue() +
      assetOracles[address(tokens[1])].currentValue();

    output = divide(numerator, result, factor);

  }

  function _calculateInvariant(
    uint256 amplificationParameter,
    uint256[] memory balances
  ) internal pure returns (uint256) {
    uint256 _AMP_PRECISION = 1e3;
    /**********************************************************************************************
        // invariant                                                                                 //
        // D = invariant                                                  D^(n+1)                    //
        // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
        // S = sum of balances                                             n^n P                     //
        // P = product of balances                                                                   //
        // n = number of tokens                                                                      //
        **********************************************************************************************/

    // Always round down, to match Vyper's arithmetic (which always truncates).

    uint256 sum = 0; // S in the Curve version
    uint256 numTokens = balances.length;
    for (uint256 i = 0; i < numTokens; i++) {
      sum = sum + (balances[i]);
    }
    if (sum == 0) {
      return 0;
    }

    uint256 prevInvariant; // Dprev in the Curve version
    uint256 invariant = sum; // D in the Curve version
    uint256 ampTimesTotal = amplificationParameter * numTokens; // Ann in the Curve version

    for (uint256 i = 0; i < 255; i++) {
      uint256 D_P = invariant;

      for (uint256 j = 0; j < numTokens; j++) {
        // (D_P * invariant) / (balances[j] * numTokens)
        D_P = divDown(mul(D_P, invariant), mul(balances[j], numTokens));
      }

      prevInvariant = invariant;

      invariant = divDown(
        mul(
          // (ampTimesTotal * sum) / AMP_PRECISION + D_P * numTokens
          (divDown(mul(ampTimesTotal, sum), _AMP_PRECISION) + (mul(D_P, numTokens))),
          invariant
        ),
        // ((ampTimesTotal - _AMP_PRECISION) * invariant) / _AMP_PRECISION + (numTokens + 1) * D_P
        (divDown(mul((ampTimesTotal - _AMP_PRECISION), invariant), _AMP_PRECISION) + (mul((numTokens + 1), D_P)))
      );

      if (invariant > prevInvariant) {
        if (invariant - prevInvariant <= 1) {
          return invariant;
        }
      } else if (prevInvariant - invariant <= 1) {
        return invariant;
      }
    }

    revert("STABLE_INVARIANT_DIDNT_CONVERGE");
  }

  /*******************************USE MIN SAFE PRICE********************************/
  ///@notice this returns a price that is typically slightly less than the naive price
  /// it should be safe to use this price, though it will be slightly less than the true naive price,
  /// so borrowing power will be slightly less than expected
  function getMinSafePrice(IERC20[] memory tokens) internal view returns (uint256 minSafePrice) {
    //uint256 rate = _priceFeed.getRate();

    (uint256 v /**uint256 amp */, ) = _priceFeed.getLastInvariant();

    uint256 calculatedRate = (v * 1e18) / _priceFeed.totalSupply();

    //get min price
    uint256 p0 = assetOracles[address(tokens[0])].currentValue();
    uint256 p1 = assetOracles[address(tokens[1])].currentValue();

    uint256 pm = p0 < p1 ? p0 : p1;

    minSafePrice = (pm * calculatedRate) / 1e18;
  }

  function mulDown(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 product = a * b;
    require(a == 0 || product / a == b, "overflow");

    return product / 1e18;
  }

  function divDown(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, "divDown: Zero division");
    return a / b;
  }

  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a * b;
    require(a == 0 || c / a == b, "mul: overflow");
    return c;
  }

  function divide(uint256 numerator, uint256 denominator, uint256 factor) internal pure returns (uint256 result) {
    uint256 q = (numerator / denominator) * 10 ** factor;
    uint256 r = ((numerator * 10 ** factor) / denominator) % 10 ** factor;

    return q + r;
  }

  /*******************************REQUIRED SETUP FUNCTIONS********************************/
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
