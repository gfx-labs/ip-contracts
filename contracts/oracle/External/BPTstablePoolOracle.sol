// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";

interface IBalancerPool {
  function getPoolId() external view returns (bytes32);

  function totalSupply() external view returns (uint256);

  function getLastInvariant() external view returns (uint256, uint256);
}

/*****************************************
 *
 * This relay gets a USD price for BPT LP token from a balancer MetaStablePool or StablePool
 * Comparing the results of outGivenIn to known safe oracles for the underlying assets,
 * we can safely determine if manipulation has transpired.
 * After confirming that the naive price is safe, we return the naive price.
 */

contract BPTstablePoolOracle is IOracleRelay {
  bytes32 public immutable _poolId;

  uint256 public immutable _widthNumerator;
  uint256 public immutable _widthDenominator;

  IBalancerPool public immutable _priceFeed;

  mapping(address => IOracleRelay) public assetOracles;

  //Balancer Vault
  IBalancerVault public immutable VAULT;

  /**
   * @param pool_address - Balancer StablePool or MetaStablePool address
   * @param balancerVault is the address for the Balancer Vault contract
   * @param _tokens should be length 2 and contain both underlying assets for the pool
   * @param _oracles shoulb be length 2 and contain a safe external on-chain oracle for each @param _tokens in the same order
   * @notice the quotient of @param widthNumerator and @param widthDenominator should be the percent difference the exchange rate
   * is able to diverge from the expected exchange rate derived from just the external oracles
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

    //register oracles
    for (uint256 i = 0; i < _tokens.length; i++) {
      assetOracles[_tokens[i]] = IOracleRelay(_oracles[i]);
    }

    _widthNumerator = widthNumerator;
    _widthDenominator = widthDenominator;
  }

  function currentValue() external view override returns (uint256) {
    (IERC20[] memory tokens, uint256[] memory balances /**uint256 lastChangeBlock */, ) = VAULT.getPoolTokens(_poolId);

    uint256 tokenAmountIn = 1000e18;

    uint256 outGivenIn = getOutGivenIn(balances, tokenAmountIn);

    (uint256 calcedRate, uint256 expectedRate) = getExchangeRates(
      outGivenIn,
      tokenAmountIn,
      assetOracles[address(tokens[0])].currentValue(),
      assetOracles[address(tokens[1])].currentValue()
    );

    verifyExchangeRate(expectedRate, calcedRate);

    uint256 naivePrice = getNaivePrice(tokens, balances);

    return naivePrice;
  }

  /*******************************GET & CHECK NAIVE PRICE********************************/
  ///@notice get the naive price by dividing the TVL/total BPT supply
  function getNaivePrice(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 naivePrice) {
    uint256 naiveTVL = 0;
    for (uint256 i = 0; i < tokens.length; i++) {
      naiveTVL += ((assetOracles[address(tokens[i])].currentValue() * balances[i]));
    }
    naivePrice = naiveTVL / _priceFeed.totalSupply();
    require(naivePrice > 0, "invalid naive price");
  }

  ///@notice ensure the exchange rate is within the expected range
  ///@notice ensuring the price is in bounds prevents price manipulation
  function verifyExchangeRate(uint256 expectedRate, uint256 outGivenInRate) internal view {
    uint256 delta = percentChange(expectedRate, outGivenInRate);
    uint256 buffer = divide(_widthNumerator, _widthDenominator, 18);

    require(delta < buffer, "Price out of bounds");
  }

  /*******************************OUT GIVEN IN********************************/
  function getOutGivenIn(uint256[] memory balances, uint256 tokenAmountIn) internal view returns (uint256 outGivenIn) {
    (uint256 v, uint256 amp) = _priceFeed.getLastInvariant();
    uint256 idxIn = 0;
    uint256 idxOut = 1;

    //first calculate the balances, math doesn't work with reported balances on their own
    uint256[] memory calcedBalances = new uint256[](2);
    calcedBalances[0] = _getTokenBalanceGivenInvariantAndAllOtherBalances(amp, balances, v, 0);
    calcedBalances[1] = _getTokenBalanceGivenInvariantAndAllOtherBalances(amp, balances, v, 1);

    //get the ending balance for output token (always index 1)
    uint256 finalBalanceOut = _calcOutGivenIn(amp, calcedBalances, idxIn, idxOut, tokenAmountIn, v);

    //outGivenIn is a function of the actual starting balance, not the calculated balance
    outGivenIn = ((balances[idxOut] - finalBalanceOut) - 1);
  }

  // Computes how many tokens can be taken out of a pool if `tokenAmountIn` are sent, given the current balances.
  // The amplification parameter equals: A n^(n-1)
  // The invariant should be rounded up.
  function _calcOutGivenIn(
    uint256 amplificationParameter,
    uint256[] memory balances,
    uint256 tokenIndexIn,
    uint256 tokenIndexOut,
    uint256 tokenAmountIn,
    uint256 invariant
  ) internal pure returns (uint256) {
    /**************************************************************************************************************
    // outGivenIn token x for y - polynomial equation to solve                                                   //
    // ay = amount out to calculate                                                                              //
    // by = balance token out                                                                                    //
    // y = by - ay (finalBalanceOut)                                                                             //
    // D = invariant                                               D                     D^(n+1)                 //
    // A = amplification coefficient               y^2 + ( S - ----------  - D) * y -  ------------- = 0         //
    // n = number of tokens                                    (A * n^n)               A * n^2n * P              //
    // S = sum of final balances but y                                                                           //
    // P = product of final balances but y                                                                       //
    **************************************************************************************************************/

    balances[tokenIndexIn] = balances[tokenIndexIn] + (tokenAmountIn);

    uint256 finalBalanceOut = _getTokenBalanceGivenInvariantAndAllOtherBalances(
      amplificationParameter,
      balances,
      invariant,
      tokenIndexOut
    );
    balances[tokenIndexIn] = balances[tokenIndexIn] - tokenAmountIn;

    //we simply return finalBalanceOut here, and get outGivenIn elsewhere
    return finalBalanceOut;
    /**
    if (balances[tokenIndexOut] > finalBalanceOut) {
      return sub(sub(balances[tokenIndexOut], finalBalanceOut), 1);
    } else {
      return 0;
    }
     */
  }

  // This function calculates the balance of a given token (tokenIndex)
  // given all the other balances and the invariant
  function _getTokenBalanceGivenInvariantAndAllOtherBalances(
    uint256 amplificationParameter,
    uint256[] memory balances,
    uint256 invariant,
    uint256 tokenIndex
  ) internal pure returns (uint256) {
    // Rounds result up overall
    uint256 _AMP_PRECISION = 1e3;

    uint256 ampTimesTotal = amplificationParameter * balances.length;
    uint256 sum = balances[0];
    uint256 P_D = balances[0] * balances.length;
    for (uint256 j = 1; j < balances.length; j++) {
      P_D = (((P_D * balances[j]) * balances.length) / invariant);
      sum = sum + balances[j];
    }
    // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[tokenIndex]`
    sum = sum - balances[tokenIndex];

    uint256 inv2 = (invariant * invariant);
    // We remove the balance from c by multiplying it
    uint256 c = ((divUp(inv2, (ampTimesTotal * P_D)) * _AMP_PRECISION) * balances[tokenIndex]);
    uint256 b = sum + ((invariant / ampTimesTotal) * _AMP_PRECISION);

    // We iterate to find the balance
    uint256 prevTokenBalance = 0;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    uint256 tokenBalance = divUp((inv2 + c), (invariant + b));

    for (uint256 i = 0; i < 255; i++) {
      prevTokenBalance = tokenBalance;

      uint256 numerator = (tokenBalance * tokenBalance) + c;
      uint256 denominator = ((tokenBalance * 2) + b) - invariant;

      tokenBalance = divUp(numerator, denominator);
      if (tokenBalance > prevTokenBalance) {
        if (tokenBalance - prevTokenBalance <= 1) {
          return tokenBalance;
        }
      } else if (prevTokenBalance - tokenBalance <= 1) {
        return tokenBalance;
      }
    }
    revert("STABLE_GET_BALANCE_DIDNT_CONVERGE");
  }

  /*******************************PURE MATH FUNCTIONS********************************/
  ///@notice get exchange rates
  function getExchangeRates(
    uint256 outGivenIn,
    uint256 tokenAmountIn,
    uint256 price0,
    uint256 price1
  ) internal pure returns (uint256 calcedRate, uint256 expectedRate) {
    expectedRate = divide(price1, price0, 18);

    uint256 numerator = divide(outGivenIn * price1, 1e18, 18);

    uint256 denominator = divide((tokenAmountIn * price0), 1e18, 18);

    calcedRate = divide(numerator, denominator, 18);
  }

  ///@notice get the percent deviation from a => b as a decimal e18
  function percentChange(uint256 a, uint256 b) internal pure returns (uint256 delta) {
    uint256 max = a > b ? a : b;
    uint256 min = b != max ? b : a;
    delta = divide((max - min), min, 18);
  }

  ///@notice floating point division at @param factor scale
  function divide(uint256 numerator, uint256 denominator, uint256 factor) internal pure returns (uint256 result) {
    uint256 q = (numerator / denominator) * 10 ** factor;
    uint256 r = ((numerator * 10 ** factor) / denominator) % 10 ** factor;

    return q + r;
  }

  function mulDown(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 product = a * b;
    require(a == 0 || product / a == b, "overflow");

    return product / 1e18;
  }

  function divUp(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, "divUp: Zero division");

    if (a == 0) {
      return 0;
    } else {
      return 1 + (a - 1) / b;
    }
  }
}
