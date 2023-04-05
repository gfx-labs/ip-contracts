// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../oracle/IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";
import "../../_external/balancer/IAsset.sol";

import "../../_external/IWETH.sol";

//test wit Aave flash loan
import "../aaveFlashLoan/FlashLoanReceiverBase.sol";

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

contract RateProofOfConcept is FlashLoanReceiverBase, IOracleRelay {
  bytes32 public immutable _poolId;

  uint256 public immutable _widthNumerator;
  uint256 public immutable _widthDenominator;

  IBalancerPool public immutable _priceFeed;

  mapping(address => IOracleRelay) public assetOracles;

  //Balancer Vault
  IBalancerVault public immutable VAULT; // = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

  // Legacy JoinKind - Applies to StablePool, MetaStablePool, StablePool V2
  enum JoinKind {
    INIT,
    EXACT_TOKENS_IN_FOR_BPT_OUT,
    TOKEN_IN_FOR_EXACT_BPT_OUT
  }

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
  ) FlashLoanReceiverBase(ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5)) {
    _priceFeed = IBalancerPool(pool_address);

    _poolId = _priceFeed.getPoolId();

    VAULT = balancerVault;

    registerOracles(_tokens, _oracles);

    _widthNumerator = widthNumerator;
    _widthDenominator = widthDenominator;
  }

  function currentValue() public view override returns (uint256) {
    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(_poolId);
    //console.log("POOL ADDR: ", address(_priceFeed));

    /**************Check Robust Price Solutions**************/
    checkLastChangedBlock(lastChangeBlock);
    compareRates();
    compareOutGivenIn(tokens, balances);
    /********************************************************/

    /********************************************************/

    uint256 naivePrice = getNaivePrice(tokens, balances);
    //console.log("NAIVE PRICE: ", naivePrice);
    //verifyNaivePrice(naivePrice, naivePrice);

    // return checked price
    return naivePrice;
  }

  /*******************************Attempt Manipulation********************************/
  function testFlashLoanManipulation(uint256 tokenBorrowIdx, uint256 amountBorrow) external payable {
    (IERC20[] memory tokens, uint256[] memory balances /**uint256 lastChangeBlock */, ) = VAULT.getPoolTokens(_poolId);
    (uint256 invariant, uint256 amplificationParameter) = _priceFeed.getLastInvariant();

    //do flash loan
    //console.log("Borrowing: ", address(tokens[tokenBorrowIdx]));
    aaveFlashLoan(address(tokens[tokenBorrowIdx]), amountBorrow);

    //check price
    //console.log("Flash Loan done");
    //console.log("Current price: ", currentValue());
  }

  function aaveFlashLoan(address tokenBorrow, uint256 amountBorrow) internal {
    //Aave expects an array, even though we are only going to pass 1
    address[] memory assets = new address[](1);
    assets[0] = tokenBorrow;

    //Aave expects an array, even though we are only going to pass 1
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = amountBorrow;

    // 0 = no debt, 1 = stable, 2 = variable
    uint256[] memory modes = new uint256[](1);
    modes[0] = 0;

    LENDING_POOL.flashLoan(
      address(this), //who receives flash loan
      assets, //borrowed assets, can be just 1
      amounts, //amounts to borrow
      modes, //what kind of loan - 0 for full repay
      address(this), //address to receive debt if mode is !0
      "0x",
      0 //referralCode - not used
    );
  }

  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address /**initiator */, //not used
    bytes calldata /**params */
  ) external override returns (bool) {
    depositIntoPool(assets[0]);

    //approve aave to take from this contract to repay
    uint256 amountOwing = amounts[0] + (premiums[0]);
    IERC20(assets[0]).approve(address(LENDING_POOL), amountOwing);
    return true;
  }

  function depositIntoPool(address asset) internal {
    //console.log("DEPOSIT INTO POOL");
    (IERC20[] memory tokens /**uint256[] memory balances */ /**uint256 lastChangeBlock */, , ) = VAULT.getPoolTokens(
      _poolId
    );

    IAsset[] memory assets = new IAsset[](2);
    assets[0] = IAsset(address(tokens[0]));
    assets[1] = IAsset(address(tokens[1]));

    uint256[] memory maxAmountsIn = new uint256[](2);
    maxAmountsIn[0] = tokens[0].balanceOf(address(this)); //should be 0
    maxAmountsIn[1] = tokens[1].balanceOf(address(this));

    bytes memory data = abi.encode(JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT);

    VAULT.joinPool(
      _poolId,
      address(this),
      address(this),
      IBalancerVault.JoinPoolRequest({
        assets: assets,
        maxAmountsIn: maxAmountsIn,
        userData: data,
        fromInternalBalance: false
      })
    );

    //console.log("Asset0: ", address(assets[0]));
    //console.log("Asset1: ", address(assets[1]));
    //console.log("Asset0 had   : ", tokens[0].balanceOf(address(this)));
    //console.log("Asset1 had   : ", tokens[1].balanceOf(address(this)));
    //console.log("Max amount in 0: ", maxAmountsIn[0]);
    //console.log("Max amount in 1: ", maxAmountsIn[1]);
    //console.log("JOININGqqqq");

    //console.log("JOINED POOL");
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

  /*******************************COMPARE RATES********************************/
  function compareRates() internal view {
    (uint256 v /**uint256 amp */, ) = _priceFeed.getLastInvariant();

    uint256 calculatedRate = (v * 1e18) / _priceFeed.totalSupply();

    uint256 reportedRate = _priceFeed.getRate();

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
  function compareOutGivenIn(IERC20[] memory tokens, uint256[] memory balances) internal view {
    (uint256 v, uint256 amp) = _priceFeed.getLastInvariant();
    uint256 idxIn = 0;
    uint256 idxOut = 1;
    uint256 tokenAmountIn = 1e20;

    //console.log("Compare OUT GIVEN IN");
    //console.log("Token in : ", address(tokens[idxIn]));
    //console.log("Token out: ", address(tokens[idxOut]));

    uint256 outGivenIn = _calcOutGivenIn(amp, balances, idxIn, idxOut, tokenAmountIn, v);

    //console.log("OUT GIVEN IN RESULT: ", outGivenIn); //102.386021679385123944
    ////console.log("True priec token 0: ", assetOracles[address(tokens[0])].currentValue());
    ////console.log("True priec token 1: ", assetOracles[address(tokens[1])].currentValue());
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
  ) internal view returns (uint256) {
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
