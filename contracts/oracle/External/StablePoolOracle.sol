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

  function getRate() external view returns (uint256);
}

/*****************************************
 *
 * This relay gets a USD price for BPT LP token from a balancer MetaStablePool
 * This can be used as a stand alone oracle as the price is checked 2 separate ways
 *
 */

contract StablePoolOracle is IOracleRelay {
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
    (IERC20[] memory tokens, uint256[] memory balances /**uint256 lastChangeBlock */, ) = VAULT.getPoolTokens(_poolId);
    (uint256 invariant, uint256 amplificationParameter) = _priceFeed.getLastInvariant();

    console.log("Data for: ", address(_priceFeed));
    /**
    uint256[] memory reverse = new uint256[](2);
    reverse[0] = balances[1];
    reverse[1] = balances[0];

    uint256 result = _calcOutGivenIn(
      reverse,
      0, //tokenIn
      1, //tokenOut
      1e18 //amountIn
    );
    console.log("Result: ", result);

   */

    //test
    //getVirtualPrice(balances, tokens);
    //rateOnly();

    uint256 naiveValue = sumBalances(tokens, balances);
    uint256 naivePrice = naiveValue / _priceFeed.totalSupply();
    require(naivePrice > 0, "invalid naive price");

    console.log("naivePrice: ", naivePrice);

    /// @notice The rate reported from the pool calculates a fresh invariant based on current balances
    /// Calculating the rate using the last invariant prevents manipulation,
    /// as such manipulation will distort the reported rate such that it does not match the calculatedRate
    compareRate(invariant);

    // return checked price
    return naivePrice;
  }

  function uncheckedBalances() internal view returns (uint256) {
    (IERC20[] memory tokens, uint256[] memory balances /**uint256 lastChangeBlock */, ) = VAULT.getPoolTokens(_poolId);
  }

  function calculateRate(uint256 v) internal view returns (uint256 calculatedRate) {
    calculatedRate = (v * 1e18) / _priceFeed.totalSupply();
  }

  function compareRate(uint256 v) internal view returns (bool) {
    uint256 calculatedRate = calculateRate(v);
    uint256 reportedRate = _priceFeed.getRate();

    uint256 buffer = 1e14; //0.0001 => 0.001%

    // create upper and lower bounds
    uint256 upperBounds = calculatedRate + buffer;
    uint256 lowerBounds = calculatedRate - buffer;

    require(reportedRate < upperBounds, "reportedRate too low");
    require(reportedRate > lowerBounds, "reportedRate too high");
  }

  function rateOnly() internal view returns (uint256) {
    uint256 rate = _priceFeed.getRate();
    //console.log("Rate: ", rate); //1.030694183860377087

    (uint256 invariant, uint256 amplificationParameter) = _priceFeed.getLastInvariant();

    console.log("Invariant: ", invariant);
    console.log("Amp Param: ", amplificationParameter);

    uint256 result = (invariant * 1e18) / _priceFeed.totalSupply(); //1.030694074550969914
    //console.log("result: ", result);

    (IERC20[] memory tokens, uint256[] memory balances /**uint256 lastChangeBlock */, ) = VAULT.getPoolTokens(_poolId);

    require(tokens.length == 2, "tokens length wrong");

    uint256 truePrice0 = assetOracles[address(tokens[0])].currentValue();

    uint256 truePrice1 = assetOracles[address(tokens[1])].currentValue();
    //console.log("True Price 0: ", truePrice0);
    //console.log("True Price 1: ", truePrice1);
    uint256 a = avg(truePrice0, truePrice1);
    //console.log("Avg: ", a);

    uint256 S = balances[0] + balances[1];

    uint256 P = balances[0] * balances[1];

    uint256 S_P = S * P;
    console.log("S_P: ", S_P);

    //console.log("PRICE??:::: ", (a * rate) / 1e18);
    console.log("avg price?: ", (a * result) / 1e18);
    console.log("p0  price?: ", (truePrice0 * result) / 1e18);
    console.log("p1  price?: ", (truePrice1 * result) / 1e18);

    /**
    avg price?:  18291087272101059390
    p0  price?:  18291099746531003727
    p1  price?:  18291074797671115053
    naivePrice:  18326395901725071798
     */

    /**
  exchange 100 U.S. Dollars for 80 Euros, the exchange rate would be 1.25.
  price0 = 17.7463907
  price1 = 17.7463665
   */
  }

  function avg(uint256 thing0, uint256 thing1) internal pure returns (uint256 a) {
    uint256 sum = thing0 + thing1;
    a = sum / 2;
  }

  /**
  Sequence of events for balancer swap
  approve relayer 0xC92E8bdf79f0507f65a392b0ab4667716BFE0110
  approve 0xBA12222222228d8Ba445958a75a0704d566BF2C8 on tokenIn contract (balancer vault)
   */

  function getVirtualPrice(uint256[] memory balances, IERC20[] memory tokens) internal view returns (uint256) {
    (uint256 invariant, uint256 amplificationParameter) = _priceFeed.getLastInvariant();
    uint256 A = amplificationParameter * 2;
    //check balances
    console.log("Starting balance 0 idx in: ", balances[0]);
    console.log("Starting balance 1 idx ot: ", balances[1]);

    uint256[] memory calcedBalances = new uint256[](2);
    calcedBalances[0] = _getTokenBalanceGivenInvariantAndAllOtherBalances(
      amplificationParameter,
      balances,
      invariant,
      0
    );

    calcedBalances[1] = _getTokenBalanceGivenInvariantAndAllOtherBalances(
      amplificationParameter,
      balances,
      invariant,
      1
    );
    console.log("Calced balance 0 idx in  : ", calcedBalances[0]);
    console.log("Calced balance 1 idx ot  : ", calcedBalances[1]);

    uint256 out = _calcOutGivenIn(
      calcedBalances,
      0, //tokenIdxIn
      1, //tokenIdxOut
      1e18 //tokenAmountIn
    );

    console.log(1e18, " token 0 in results in ", out);

    //compare this rate to the token 0 => token 1 trusted oracle price rate

    uint256 truePrice0 = assetOracles[address(tokens[0])].currentValue();

    uint256 truePrice1 = assetOracles[address(tokens[1])].currentValue();
    console.log("True Price 0: ", truePrice0);
    console.log("True Price 1: ", truePrice1);

    (uint256 quotient, uint256 remainder, string memory result) = division(18, truePrice0 * 1e18, truePrice1);

    uint256 trueRate = quotient + remainder;

    console.log("trusted oracle rate: ", trueRate);

    /**
    apple costs 5
    orange costs 8




    100 apples traded for oranges nets 100(5) = 8x => 62.5


     */
  }

  // Computes how many tokens can be taken out of a pool if `tokenAmountIn` are sent, given the current balances.
  // The amplification parameter equals: A n^(n-1)
  // The invariant should be rounded up.
  function _calcOutGivenIn(
    //uint256 amplificationParameter,
    uint256[] memory balances,
    uint256 tokenIndexIn,
    uint256 tokenIndexOut,
    uint256 tokenAmountIn
  )
    internal
    view
    returns (
      //uint256 invariant

      uint256
    )
  {
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

    (uint256 invariant, uint256 amplificationParameter) = _priceFeed.getLastInvariant();

    balances[tokenIndexIn] = balances[tokenIndexIn] + tokenAmountIn;
    //console.log("New balance idx in: ", balances[tokenIndexIn]);

    uint256 finalBalanceOut = _getTokenBalanceGivenInvariantAndAllOtherBalances(
      amplificationParameter,
      balances,
      invariant,
      tokenIndexOut
    );

    // No need to use checked arithmetic since `tokenAmountIn` was actually added to the same balance right before
    // calling `_getTokenBalanceGivenInvariantAndAllOtherBalances` which doesn't alter the balances array.
    balances[tokenIndexIn] = balances[tokenIndexIn] - tokenAmountIn;

    uint256 finalBalancesIdxIn = balances[tokenIndexOut];

    //console.log("Final sub");
    //console.log("Redo idx out balance: ", balances[tokenIndexOut]); //712049.743081
    //console.log("Final token out amnts: ", finalBalanceOut); //712048.612166

    //console.log("Result: ", sub(sub(balances[tokenIndexOut], finalBalanceOut), 1));

    return sub(sub(balances[tokenIndexOut], finalBalanceOut), 1);
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
    uint256 b = add(sum, mul(divDown(invariant, ampTimesTotal), _AMP_PRECISION));

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

  function division(
    uint256 decimalPlaces,
    uint256 numerator,
    uint256 denominator
  ) public pure returns (uint256 quotient, uint256 remainder, string memory result) {
    uint256 factor = 10 ** decimalPlaces;
    quotient = numerator / denominator;
    remainder = ((numerator * factor) / denominator) % factor;
    result = string(abi.encodePacked(toString(quotient), ".", toString(remainder)));
  }

  function divide(uint256 numerator, uint256 denominator, uint256 factor) internal view returns (uint256) {
    console.log("DIVIDE");
    uint256 q = (numerator / denominator) * 10 ** factor;
    console.log("Q: ", q);
    uint256 r = ((numerator * 10 ** factor) / denominator) % 10 ** factor;
    console.log("r: ", r);

    return q + r;
  }

  /**OZ FUNCTIONS */

  function toString(uint256 value) internal pure returns (string memory) {
    bytes memory _SYMBOLS = "0123456789abcdef";
    unchecked {
      uint256 length = log10(value) + 1;
      string memory buffer = new string(length);
      uint256 ptr;
      /// @solidity memory-safe-assembly
      assembly {
        ptr := add(buffer, add(32, length))
      }
      while (true) {
        ptr--;
        /// @solidity memory-safe-assembly
        assembly {
          mstore8(ptr, byte(mod(value, 10), _SYMBOLS))
        }
        value /= 10;
        if (value == 0) break;
      }
      return buffer;
    }
  }

  /**
   * @dev Return the log in base 10, rounded down, of a positive value.
   * Returns 0 if given 0.
   */
  function log10(uint256 value) internal pure returns (uint256) {
    uint256 result = 0;
    unchecked {
      if (value >= 10 ** 64) {
        value /= 10 ** 64;
        result += 64;
      }
      if (value >= 10 ** 32) {
        value /= 10 ** 32;
        result += 32;
      }
      if (value >= 10 ** 16) {
        value /= 10 ** 16;
        result += 16;
      }
      if (value >= 10 ** 8) {
        value /= 10 ** 8;
        result += 8;
      }
      if (value >= 10 ** 4) {
        value /= 10 ** 4;
        result += 4;
      }
      if (value >= 10 ** 2) {
        value /= 10 ** 2;
        result += 2;
      }
      if (value >= 10 ** 1) {
        result += 1;
      }
    }
    return result;
  }
}
