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

contract BPTstablePoolOracle is UsingBaseOracle, IBaseOracle, IOracleRelay {
  using HomoraMath for uint;
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
  ) UsingBaseOracle(IBaseOracle(pool_address)) {
    _priceFeed = IBalancerPool(pool_address);

    _poolId = _priceFeed.getPoolId();

    VAULT = balancerVault;

    registerOracles(_tokens, _oracles);

    _widthNumerator = widthNumerator;
    _widthDenominator = widthDenominator;
  }

  function currentValue() external view override returns (uint256) {
    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(_poolId);
    console.log("POOL ADDR: ", address(_priceFeed));
    console.log("Token 0: ", address(tokens[0]));
    console.log("Token 1: ", address(tokens[1]));
    console.log("Token0 price : ", assetOracles[address(tokens[0])].currentValue());
    console.log("Token1 price : ", assetOracles[address(tokens[1])].currentValue());

    /**************Check Robust Price Solutions**************/
    checkLastChangedBlock(lastChangeBlock);
    compareRates();
    compareOutGivenIn(tokens, balances);
    uint256 spotRobustPrice = getBPTprice(tokens, balances);
    getOracleData();
    uint256 pxPrice = getETHPx(address(_priceFeed));
    simpleCalc();
    /********************************************************/

    uint256 naivePrice = getNaivePrice(tokens, balances);
    console.log("RBST  price: ", spotRobustPrice);
    console.log("NAIVE PRICE: ", naivePrice);

    //verifyNaivePrice(naivePrice, naivePrice);

    // return checked price
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

  /*******************************BASE ORACLE ALPHA METHOD********************************/

  function getETHPx(address pool) public view override returns (uint) {
    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(_poolId);
    address token0 = address(tokens[0]);
    address token1 = address(tokens[1]);
    uint totalSupply = _priceFeed.totalSupply();
    uint r0 = balances[0];
    uint r1 = balances[1];

    uint sqrtK = HomoraMath.sqrt(r0 * r1).fdiv(totalSupply);

    uint px0 = assetOracles[address(tokens[0])].currentValue() * 2 ** 112;
    uint px1 = assetOracles[address(tokens[1])].currentValue() * 2 ** 112;
    // fair token0 amt: sqrtK * sqrt(px1/px0)
    // fair token1 amt: sqrtK * sqrt(px0/px1)
    // fair lp price = 2 * sqrt(px0 * px1)
    // split into 2 sqrts multiplication to prevent uint overflow (note the 2**112)

    uint result = sqrtK.mul(2).mul(HomoraMath.sqrt(px0)).div(2 ** 56).mul(HomoraMath.sqrt(px1)).div(2 ** 56);
    console.log("Modified112: ", result / 2 ** 112);
    return result;
  }

  //https://cmichel.io/pricing-lp-tokens/
  function simpleCalc() public view {
    //2 sqrt(p0 p1 k)
    //--------------
    //      L
    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(_poolId);
    (uint256 invariant, uint256 amp) = _priceFeed.getLastInvariant();

    uint px0 = assetOracles[address(tokens[0])].currentValue();
    uint px1 = assetOracles[address(tokens[1])].currentValue();

    uint256 a = amp * 2;
    uint256 V = (invariant * a) - invariant;

    uint256 K = V / a;

    uint256 numerator = 2 * HomoraMath.sqrt(px0 * px1 * V);
    //console.log("Simple Math Result: ", numerator / _priceFeed.totalSupply());
  }

  /*******************************UTILIZE METASTABLEPOOL LOG ORACLE********************************/

  function getOracleData() internal view {
    if (address(_priceFeed) != 0x3dd0843A028C86e0b760b1A76929d1C5Ef93a2dd) {
      (
        int256 logInvariant,
        int256 logTotalSupply,
        uint256 oracleSampleCreationTimestamp,
        uint256 oracleIndex,
        bool oracleEnabled
      ) = _priceFeed.getOracleMiscData();

      uint256 v = fromLowResLog(logInvariant);
      uint256 ts = fromLowResLog(logTotalSupply);

      uint256 oracleRate = (v * 1e18) / ts;
      console.log("Oracle rate  : ", oracleRate);
    }
  }

  /**
   * @dev Restores `value` from logarithmic space. `value` is expected to be the result of a call to `toLowResLog`,
   * any other function that returns 4 decimals fixed point logarithms, or the sum of such values.
   */
  function fromLowResLog(int256 value) internal pure returns (uint256) {
    int256 _LOG_COMPRESSION_FACTOR = 1e14;
    return uint256(LogExpMath.exp(value * _LOG_COMPRESSION_FACTOR));
  }

  /*******************************CALCULATE SPOT PRICE********************************/
  function getBPTprice(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 price) {
    uint256 pyx = getSpotPrice(balances);
    uint256[] memory reverse = new uint256[](2);
    reverse[0] = balances[1];
    reverse[1] = balances[0];

    uint256 pxy = getSpotPrice(reverse);

    //console.log("token 0 => 1 : ", pyx);
    //console.log("token 1 => 0 : ", pxy);

    //uint256 valueX = ((balances[0] * assetOracles[address(tokens[0])].currentValue()));
    uint256 valueX = (((pxy * balances[0]) * assetOracles[address(tokens[0])].currentValue()) / 1e18);

    uint256 valueY = (((pyx * balances[1]) * assetOracles[address(tokens[1])].currentValue()) / 1e18);

    uint256 totalValue = valueX + valueY;

    price = (totalValue / _priceFeed.totalSupply());
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

    pyx = divUpSpot(derivativeX, derivativeY);
  }

  function mulDown(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 product = a * b;
    require(a == 0 || product / a == b, "overflow");

    return product / 1e18;
  }

  function divUpSpot(uint256 a, uint256 b) internal pure returns (uint256) {
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

  /*******************************COMPARE RATES********************************/
  function compareRates() internal view {
    (uint256 v /**uint256 amp */, ) = _priceFeed.getLastInvariant();

    uint256 calculatedRate = (v * 1e18) / _priceFeed.totalSupply();

    uint256 reportedRate = _priceFeed.getRate();
    console.log("Invariant: ", v);

    console.log("computed rate: ", calculatedRate);
    console.log("Reported Rate: ", reportedRate);
    console.log("Inverted rate: ", divide(1e18, reportedRate, 18));

    ///@notice theoreticly if the rates diverge, then the price may have been manipulated
    /// todo test this theory
    uint256 buffer = 1e14; //0.0001 => 0.001%

    // create upper and lower bounds
    uint256 upperBounds = calculatedRate + buffer;
    uint256 lowerBounds = calculatedRate - buffer;

    require(reportedRate < upperBounds, "reportedRate too low");
    require(reportedRate > lowerBounds, "reportedRate too high");
  }

  /*******************************GET VIRTUAL PRICE USING outGivenIn********************************/
  //idea https://github.com/balancer/balancer-v2-monorepo/blob/d2794ef7d8f6d321cde36b7c536e8d51971688bd/pkg/vault/contracts/balances/TwoTokenPoolsBalance.sol#L334
  //decode cash vs managed to see if maybe the input balances are wrong somehow
  function compareOutGivenIn(IERC20[] memory tokens, uint256[] memory balances) internal view {
    (uint256 v, uint256 amp) = _priceFeed.getLastInvariant();
    uint256 idxIn = 0;
    uint256 idxOut = 1;
    uint256 tokenAmountIn = 1e18;

    // console.log("Compare OUT GIVEN IN");
    //console.log("Token in : ", address(tokens[idxIn]));
    //console.log("Token out: ", address(tokens[idxOut]));

    uint256 outGivenIn = _calcOutGivenIn(amp, balances, idxIn, idxOut, tokenAmountIn, v);

    bool requireCalcedBalances = false;
    if (outGivenIn == 0) {
      requireCalcedBalances = true;

      uint256[] memory calcedBalances = new uint256[](2);
      calcedBalances[0] = _getTokenBalanceGivenInvariantAndAllOtherBalances(amp, balances, v, 0);

      calcedBalances[1] = _getTokenBalanceGivenInvariantAndAllOtherBalances(amp, balances, v, 1);
      outGivenIn = _calcOutGivenIn(amp, calcedBalances, idxIn, idxOut, tokenAmountIn, v);
    }

    (uint256 calcedRate, uint256 expectedRate) = getOutGivenInRate(
      outGivenIn,
      assetOracles[address(tokens[0])].currentValue(),
      assetOracles[address(tokens[1])].currentValue()
    );
    //simple out given in should be price 0 * expectedRate
    uint256 expectedOutput = assetOracles[address(tokens[0])].currentValue() * expectedRate;
    console.log("Expected Rate: ", expectedRate);
    console.log("Out given in : ", outGivenIn);

    console.log("Expected OGI : ", divide(expectedOutput, 1e36, 18));

    console.log("Computed Rate: ", calcedRate);

    // console.log("Required calced balances?: ", requireCalcedBalances);
    // console.log("OUT GIVEN IN RESULT: ", outGivenIn);
    //console.log("OUT GIVEN IN RESULT: ", outGivenIn); //102.386021679385123944
  }

  function getSimpleRate(uint256 price0, uint256 price1) internal pure returns (uint256 expectedRate) {
    //rate  p1 / p0
    expectedRate = divide(price1, price0, 18);
  }

  function getOutGivenInRate(
    uint256 ogi,
    uint256 price0,
    uint256 price1
  ) internal pure returns (uint256 calcedRate, uint256 expectedRate) {
    expectedRate = getSimpleRate(price0, price1);

    uint256 numerator = divide(ogi * price1, 1e18, 18);

    uint256 denominator = divide((1e18 * price0), 1e18, 18);

    calcedRate = divide(numerator, denominator, 18);
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

    // Amount out, so we round down overall.
    //console.log("Pre balance token in: ", balances[tokenIndexIn]);
    balances[tokenIndexIn] = balances[tokenIndexIn] + (tokenAmountIn);
    //console.log("pst balance token in: ", balances[tokenIndexIn]);

    uint256 finalBalanceOut = _getTokenBalanceGivenInvariantAndAllOtherBalances(
      amplificationParameter,
      balances,
      invariant,
      tokenIndexOut
    );

    // No need to use checked arithmetic since `tokenAmountIn` was actually added to the same balance right before
    // calling `_getTokenBalanceGivenInvariantAndAllOtherBalances` which doesn't alter the balances array.
    balances[tokenIndexIn] = balances[tokenIndexIn] - tokenAmountIn;
    //console.log("end balance token in: ", balances[tokenIndexIn]);

    //console.log("Balance token out: ", balances[tokenIndexOut]);
    //console.log("Final balance out: ", finalBalanceOut);

    if (balances[tokenIndexOut] > finalBalanceOut) {
      return sub(sub(balances[tokenIndexOut], finalBalanceOut), 1);
    } else {
      //console.log("Balances failed");
      return 0;
    }
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
      P_D = divDown(mul(mul(P_D, balances[j]), balances.length), invariant);
      sum = add(sum, balances[j]);
    }
    // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[tokenIndex]`
    sum = sum - balances[tokenIndex];

    uint256 inv2 = mul(invariant, invariant);
    // We remove the balance from c by multiplying it
    uint256 c = mul(mul(divUp(inv2, mul(ampTimesTotal, P_D)), _AMP_PRECISION), balances[tokenIndex]);
    uint256 b = sum + mul(divDown(invariant, ampTimesTotal), _AMP_PRECISION);

    // We iterate to find the balance
    uint256 prevTokenBalance = 0;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    uint256 tokenBalance = divUp(add(inv2, c), add(invariant, b));

    for (uint256 i = 0; i < 255; i++) {
      prevTokenBalance = tokenBalance;

      //tokenBalance = divUp(add(mul(tokenBalance, tokenBalance), c), sub(add(mul(tokenBalance, 2), b), invariant));

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

  function divDown(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, "divDown: Zero division");
    return a / b;
  }

  function divUp(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, "divUp: Zero division");

    if (a == 0) {
      return 0;
    } else {
      return 1 + (a - 1) / b;
    }
  }

  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a * b;
    require(a == 0 || c / a == b, "mul: overflow");
    return c;
  }

  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    require(c >= a, "ADD_OVERFLOW");
    return c;
  }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b <= a, "SUB_OVERFLOW");
    uint256 c = a - b;
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
