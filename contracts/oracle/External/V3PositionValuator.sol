// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../oracle/IOracleRelay.sol";

import "../../_external/uniswap/TickMath.sol";
import "../../_external/uniswap/LiquidityAmounts.sol";
import "../../_external/uniswap/INonfungiblePositionManager.sol";
import "../../_external/uniswap/PoolAddress.sol";
import "../../_external/uniswap/IUniV3Pool.sol";

import "../../_external/IERC20.sol";

import "../../_external/openzeppelin/OwnableUpgradeable.sol";
import "../../_external/openzeppelin/Initializable.sol";

contract V3PositionValuator is Initializable, OwnableUpgradeable, IOracleRelay {
  address public FACTORY_V3; //= 0x1F98431c8aD98523631AE4a59f267346ea31F984;
  INonfungiblePositionManager public nfpManager;
  //INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

  mapping(address => bool) public registeredPools;
  mapping(address => PoolData) public poolDatas;

  ///@notice register data associated with pool
  ///@param tickSpacing is immutable, so storing it here is safe
  struct PoolData {
    IOracleRelay token0Oracle;
    IOracleRelay token1Oracle;
    uint256 UNIT_0;
    uint256 UNIT_1;
    int24 tickSpacing;
  }

  struct VerifyData {
    address pool;
    bool registered;
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidity;
  }

  function initialize(INonfungiblePositionManager _nfpManager, address _factoryV3) public initializer {
    __Ownable_init();
    nfpManager = _nfpManager;
    FACTORY_V3 = _factoryV3;
  }

  ///@notice we return 1 here, as the true value is achieved through balanceOf
  ///@notice we can't return the true value here as we need to be passed the liquidity
  function currentValue() external pure override returns (uint256) {
    return 1e18;
  }

  ///@notice this is called by the custom balanceOf logic on the cap token
  ///@notice returns the value of the position in USDi
  function getValue(uint256 tokenId) external view returns (uint256) {
    VerifyData memory vData = verifyPool(tokenId);
    PoolData memory data = poolDatas[vData.pool];

    //unregistered pools will not have external oracle prices registered, and so won't work
    if (!vData.registered) {
      return 0;
    }
    //independantly calculate sqrtPrice using external oracles
    (uint160 sqrtPriceX96, uint256 p0, uint256 p1) = getSqrtPrice(data);

    //get liquidity
    (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
      sqrtPriceX96,
      TickMath.getSqrtRatioAtTick(vData.tickLower), //sqrtRatioAX96
      TickMath.getSqrtRatioAtTick(vData.tickUpper), //sqrtRatioBX96
      vData.liquidity
    );

    //derive value based on price * amount
    return ((amount0 * p0) / data.UNIT_0) + ((amount1 * p1) / data.UNIT_1);
  }

  ///@notice compute the pool address using the info associated with @param tokenId
  ///@notice if pool is not registered, value is always 0
  ///@notice this is because we cannot assign a value without external oracle prices for the underlying
  function verifyPool(uint256 tokenId) public view returns (VerifyData memory) {
    (
      ,
      ,
      address token0,
      address token1,
      uint24 fee,
      int24 tickLower,
      int24 tickUpper,
      uint128 liquidity,
      ,
      ,
      ,

    ) = nfpManager.positions(tokenId);

    address pool = PoolAddress.computeAddress(
      FACTORY_V3,
      PoolAddress.PoolKey({token0: token0, token1: token1, fee: uint24(fee)})
    );
    return
      VerifyData({
        pool: pool,
        registered: registeredPools[pool],
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidity: liquidity
      });
  }

  ///@notice toggle @param pool registered or not
  //todo register oracles and token units to each pool in a struct
  function registerPool(IUniV3Pool pool, IOracleRelay _token0Oracle, IOracleRelay _token1Oracle) external onlyOwner {
    registeredPools[address(pool)] = !registeredPools[address(pool)];
    poolDatas[address(pool)] = PoolData({
      token0Oracle: _token0Oracle,
      token1Oracle: _token1Oracle,
      UNIT_0: 10 ** IERC20(pool.token0()).decimals(),
      UNIT_1: 10 ** IERC20(pool.token1()).decimals(),
      tickSpacing: pool.tickSpacing()
    });
  }

  //https://github.com/makerdao/univ3-lp-oracle/blob/master/src/GUniLPOracle.sol#L248
  function getSqrtPrice(PoolData memory data) internal view returns (uint160 sqrtPrice, uint256 p0, uint256 p1) {
    //modify price by units
    p0 = data.token0Oracle.currentValue() / (1e18 / data.UNIT_0);
    p1 = data.token1Oracle.currentValue() / (1e18 / data.UNIT_1);

    uint256 numerator = _mul(_mul(p0, data.UNIT_1), (1 << 96));
    uint256 denominator = _mul(p1, data.UNIT_0);
    uint256 Q = numerator / denominator;
    uint256 sqrtQ = sqrt(Q);
    sqrtPrice = toUint160(sqrtQ << 48);
  }

  function toUint160(uint256 x) internal pure returns (uint160 z) {
    require((z = uint160(x)) == x, "GUniLPOracle/uint160-overflow");
  }

  function _mul(uint256 _x, uint256 _y) internal pure returns (uint256 z) {
    require(_y == 0 || (z = _x * _y) / _y == _x, "GUniLPOracle/mul-overflow");
  }

  // FROM https://github.com/abdk-consulting/abdk-libraries-solidity/blob/16d7e1dd8628dfa2f88d5dadab731df7ada70bdd/ABDKMath64x64.sol#L687
  function sqrt(uint256 _x) private pure returns (uint128) {
    if (_x == 0) return 0;
    else {
      uint256 xx = _x;
      uint256 r = 1;
      if (xx >= 0x100000000000000000000000000000000) {
        xx >>= 128;
        r <<= 64;
      }
      if (xx >= 0x10000000000000000) {
        xx >>= 64;
        r <<= 32;
      }
      if (xx >= 0x100000000) {
        xx >>= 32;
        r <<= 16;
      }
      if (xx >= 0x10000) {
        xx >>= 16;
        r <<= 8;
      }
      if (xx >= 0x100) {
        xx >>= 8;
        r <<= 4;
      }
      if (xx >= 0x10) {
        xx >>= 4;
        r <<= 2;
      }
      if (xx >= 0x8) {
        r <<= 1;
      }
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1;
      r = (r + _x / r) >> 1; // Seven iterations should be enough
      uint256 r1 = _x / r;
      return uint128(r < r1 ? r : r1);
    }
  }
}
