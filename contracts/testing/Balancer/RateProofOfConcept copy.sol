// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../oracle/IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";
import "../../_external/balancer/IAsset.sol";

import "../../_external/IWETH.sol";

import "../../_external/PRBMath/PRBMathSD59x18.sol";

//test wit Aave flash loan
import "../aaveFlashLoan/FlashLoanReceiverBase.sol";

import "hardhat/console.sol";

interface IBalancerPool {
  function getPoolId() external view returns (bytes32);

  function totalSupply() external view returns (uint256);

  function getLastInvariant() external view returns (uint256, uint256);

  function getRate() external view returns (uint256);

  function onJoinPool(
    bytes32 poolId,
    address sender,
    address recipient,
    uint256[] memory balances,
    uint256 lastChangeBlock,
    uint256 protocolSwapFeePercentage,
    bytes memory userData
  ) external returns (uint256[] memory amountsIn, uint256[] memory dueProtocolFeeAmounts);
}

/*****************************************
 *
 * This relay gets a USD price for BPT LP token from a balancer MetaStablePool
 * This can be used as a stand alone oracle as the price is checked 2 separate ways
 *
 */

contract RateProofOfConceptOld is FlashLoanReceiverBase, IOracleRelay {
  using PRBMathSD59x18 for *;

  bytes32 public immutable _poolId;

  uint256 public immutable _widthNumerator;
  uint256 public immutable _widthDenominator;

  IBalancerPool public immutable _priceFeed;

  mapping(address => IOracleRelay) public assetOracles;

  //Balancer Vault
  IBalancerVault public immutable VAULT; // = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

  /**
  enum JoinKind {
    INIT,
    EXACT_TOKENS_IN_FOR_BPT_OUT,
    TOKEN_IN_FOR_EXACT_BPT_OUT,
    ALL_TOKENS_IN_FOR_EXACT_BPT_OUT
  }
   */

  // Legacy JoinKind - Applies to StablePool, MetaStablePool, StablePool V2
  enum JoinKind {
    INIT,
    EXACT_TOKENS_IN_FOR_BPT_OUT,
    TOKEN_IN_FOR_EXACT_BPT_OUT
  }

  enum PoolSpecialization {
    GENERAL,
    MINIMAL_SWAP_INFO,
    TWO_TOKEN
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

  function calculateRate(uint256 v) internal view returns (uint256 calculatedRate) {
    calculatedRate = (v * 1e18) / _priceFeed.totalSupply();
  }

  function compareRate(uint256 v) internal view returns (bool) {
    uint256 calculatedRate = calculateRate(v);
    uint256 reportedRate = _priceFeed.getRate();

    uint256 buffer = 1e14; //0.0001 => 0.01%

    // create upper and lower bounds
    uint256 upperBounds = calculatedRate + buffer;
    uint256 lowerBounds = calculatedRate - buffer;

    require(reportedRate < upperBounds, "reportedRate too low");
    require(reportedRate > lowerBounds, "reportedRate too high");
  }

  function testFlashLoanManipulation(uint256 tokenBorrowIdx, uint256 amountBorrow) external payable {
    (IERC20[] memory tokens, uint256[] memory balances /**uint256 lastChangeBlock */, ) = VAULT.getPoolTokens(_poolId);
    (uint256 invariant, uint256 amplificationParameter) = _priceFeed.getLastInvariant();

    //do flash loan
    console.log("Borrowing: ", address(tokens[tokenBorrowIdx]));
    aaveFlashLoan(address(tokens[tokenBorrowIdx]), amountBorrow);

    //check price
    console.log("Flash Loan done");
    console.log("Current price: ", currentValue());
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
    bytes calldata params
  ) external override returns (bool) {
    depositIntoPool(assets[0]);

    //approve aave to take from this contract to repay
    uint256 amountOwing = amounts[0] + (premiums[0]);
    wrapEther(amountOwing);
    IERC20(assets[0]).approve(address(LENDING_POOL), amountOwing);
    return true;
  }

  /**
  Trace through join pool
  Able to get error from validate tokens
  https://github.com/balancer/balancer-v2-monorepo/blob/d2794ef7d8f6d321cde36b7c536e8d51971688bd/pkg/vault/contracts/PoolBalances.sol#L124

  Leads to onJoinPool on Base Pool
  https://github.com/balancer/balancer-v2-monorepo/blob/77c1feff3e2c1380812b1f0cfe94750c2c5dcdce/pkg/pool-utils/contracts/BasePool.sol#L289
   */
  function depositIntoPool(address asset) internal {
    console.log("DEPOSIT INTO POOL");
    (IERC20[] memory tokens, uint256[] memory balances /**uint256 lastChangeBlock */, ) = VAULT.getPoolTokens(_poolId);
    //console.log("Balances 0 init: ", balances[0]);
    //console.log("Balances 1 init: ", balances[1]);

    convertToNatEth();

    IAsset[] memory assets = new IAsset[](2);
    assets[0] = IAsset(address(tokens[0]));
    assets[1] = IAsset(address(0x0)); //IAsset(address(tokens[1]));

    uint256[] memory maxAmountsIn = new uint256[](2);
    maxAmountsIn[0] = tokens[0].balanceOf(address(this)); //should be 0
    maxAmountsIn[1] = address(this).balance; //tokens[1].balanceOf(address(this));

    //console.log("Asset0: ", address(assets[0]));
    //console.log("Asset1: ", address(assets[1]));
    //console.log("Asset0 had   : ", tokens[0].balanceOf(address(this)));
    //console.log("Asset1 had   : ", tokens[1].balanceOf(address(this)));
    console.log("Max amount in 0: ", maxAmountsIn[0]);
    console.log("Max amount in 1: ", maxAmountsIn[1]);

    bytes memory data = abi.encode(JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT);

    console.log("JOINING");

    IBalancerPool pool = IBalancerPool(address(_priceFeed));

    /// NEXT another idea, steal BPT and exit pool in bulk to move balances? 
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

    console.log("JOINED POOL");
  }

  function convertToNatEth() internal {
    address weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    IWETH W = IWETH(weth);
    IERC20 WETH = IERC20(weth);

    uint256 wethBalance = WETH.balanceOf(address(this));
    console.log("wethBalance: ", wethBalance);
    W.approve(weth, wethBalance);
    W.withdraw(wethBalance);

    wethBalance = WETH.balanceOf(address(this));
    console.log("wethBalance: ", wethBalance);
  }

  function wrapEther(uint256 ethAmount) internal {
    address weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    IWETH(weth).deposit{value: ethAmount}();
  }

  function sumBalances(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 total) {
    total = 0;
    for (uint256 i = 0; i < tokens.length; i++) {
      total += ((assetOracles[address(tokens[i])].currentValue() * balances[i]));
      console.log("");
      console.log("Token: ", address(tokens[i]));
      console.log("Price: ", (assetOracles[address(tokens[i])].currentValue()));
    }
  }

  function registerOracles(address[] memory _tokens, address[] memory _oracles) internal {
    for (uint256 i = 0; i < _tokens.length; i++) {
      assetOracles[_tokens[i]] = IOracleRelay(_oracles[i]);
    }
  }

  receive() external payable {}
}
