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
    (IERC20[] memory tokens, uint256[] memory balances /**uint256 lastChangeBlock */, ) = VAULT.getPoolTokens(_poolId);
    //invariantFormula(tokens, balances);
    getVirtualPrice(balances);

    uint256 naiveValue = sumBalances(tokens, balances);
    uint256 naivePrice = naiveValue / _priceFeed.totalSupply();
    require(naivePrice > 0, "invalid naive price");

    uint256 robustPrice = getBPTprice(tokens, balances);
    //console.log("Robust price: ", robustPrice);
    console.log("naive price: ", naivePrice);

    require(robustPrice > 0, "invalid robust price");

    // calculate buffer
    uint256 buffer = (_widthNumerator * naivePrice) / _widthDenominator;

    // create upper and lower bounds
    uint256 upperBounds = naivePrice + buffer;
    uint256 lowerBounds = naivePrice - buffer;

    //console.log("naive Price: ", naivePrice, naivePrice / 1e18);
    //console.log("Robust Price: ", robustPrice, robustPrice / 1e18);

    // ensure the robust price is within bounds
    require(robustPrice < upperBounds, "robustPrice too low");
    require(robustPrice > lowerBounds, "robustPrice too high");

    // return checked price
    return robustPrice;
  }

  /**
   * @dev Calculates the spot price of token Y in terms of token X.
   */
  function getSpotPrice(uint256[] memory balances) internal view returns (uint256 pyx) {
    (uint256 invariant, uint256 amp) = _priceFeed.getLastInvariant();

    /**
    console.log("Invariant: ", invariant, invariant / 1e18);
    console.log("Amp: ", amp);
    console.log("Balance0: ", balances[0], balances[0] / 1e18);
    console.log("Balance1: ", balances[1], balances[0] / 1e18);
     */

    uint256 a = amp * 2;
    uint256 b = (invariant * a) - invariant;

    uint256 axy2 = mulDown(((a * 2) * balances[0]), balances[1]);

    // dx = a.x.y.2 + a.y^2 - b.y
    uint256 derivativeX = mulDown(axy2 + (a * balances[0]), balances[1]) - (mulDown(b, balances[1]));

    // dy = a.x.y.2 + a.x^2 - b.x
    uint256 derivativeY = mulDown(axy2 + (a * balances[0]), balances[1]) - (mulDown(b, balances[0]));

    pyx = divUp(derivativeX, derivativeY);
  }

  /**
   D invariant calculation in non-overflowing integer operations
    iteratively
    A * sum(x_i) * n**n + D = A * D * n**n + D**(n+1) / (n**n * prod(x_i))
    Converging solution:
    D[j+1] = (A * n**n * sum(x_i) - D[j]**(n+1) / (n**n prod(x_i))) / (A * n**n - 1)
   */
  function getVirtualPrice(uint256[] memory balances) internal view returns (uint256) {
    (uint256 invariant, uint256 amp) = _priceFeed.getLastInvariant();
    uint256 tokenSupply = _priceFeed.totalSupply();

    console.log("Invariant: ", invariant);
    console.log("Amp: ", amp);

    //get conversion rate for each
    //get rate and invert?

    uint256 spotPrice = getSpotPrice(balances);

    //inverse rate => divide 1 / rate == inverse rate
    (uint256 quotient, uint256 remainder, string memory result) = division(18, 1e18, spotPrice); //divide(1e18, spotPrice, 1e18);

    uint256 inverse = (quotient * 1e18) + remainder;

    uint256 D = getD(spotPrice, inverse, amp);

    uint256 virtualPrice = (D * 1e18) / tokenSupply;

    console.log("spo: ", spotPrice);
    console.log("inv: ", inverse);
    console.log("???: ", (invariant * 1e18) / tokenSupply);

    //console.log("VIRTUAL PRICE: ", virtualPrice);
  }

  function getD(uint256 spotPrice, uint256 inverse, uint256 amp) internal view returns (uint256) {
    uint256 N_COINS = 2;

    uint256 S = 0;
    uint256 Dprev = 0;

    S = inverse + spotPrice;
    if (S == 0) {
      return 0;
    }

    uint256 D = S;
    uint256 Ann = amp + (N_COINS * 1e18);

    for (uint i = 0; i < 255; i++) {
      uint256 D_P = D;

      D_P = (D_P * D) / (spotPrice * N_COINS);
      D_P = (D_P * D) / (inverse * N_COINS);

      Dprev = D;
      uint256 numerator = (((Ann * S) / 1e18 + D_P * N_COINS) * D);

      uint256 denominator = (((Ann - 1e18) * D) / 1e18 + (N_COINS + 1) * D_P);

      D = numerator / denominator;
      if (D > Dprev) {
        if (D - Dprev <= 1) {
          return D;
        }
      } else {
        if (Dprev - D <= 1) {
          return D;
        }
      }
    }
  }

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
  }

  function invariantFormula(IERC20[] memory tokens, uint256[] memory balances) internal view {
    //int256 weightModifier = int256(1e18) / (int256(5e17).pow(int256(5e17)) * 2);
    (uint256 invariant, uint256 amp) = _priceFeed.getLastInvariant();
    uint256 a = amp * 2;
    uint256 V = (invariant * a) - invariant;

    uint256 K = V / a;

    int256 totalPi = PRBMathSD59x18.fromInt(1e18);

    uint256[] memory prices = new uint256[](tokens.length);

    int256 weight = int256(5e17);

    for (uint256 i = 0; i < tokens.length; i++) {
      balances[i] = (balances[i] * (10 ** 18)) / (10 ** IERC20(address(tokens[i])).decimals());
      prices[i] = assetOracles[address(tokens[i])].currentValue();

      int256 val = int256(prices[i]).div(weight);

      int256 indivPi = val.pow(weight);

      totalPi = totalPi.mul(indivPi);
    }

    int256 numerator = (totalPi.mul(int256(K))).div(int256(1e18));
    uint256 price = uint256((numerator.toInt().div(int256(_priceFeed.totalSupply()))));

    console.log("Formula price result: ", price / 2);
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
