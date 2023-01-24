// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../IOracleRelay.sol";
import "../../_external/IERC20.sol";
import "../../_external/balancer/IBalancerVault.sol";

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
  uint256 public immutable _multiply;
  uint256 public immutable _divide;

  IBalancerPool private immutable _priceFeed;
  IOracleRelay public constant ethOracle = IOracleRelay(0x22B01826063564CBe01Ef47B96d623b739F82Bf2);

  mapping(address => IOracleRelay) public assetOracles;

  //Balancer Vault
  IBalancerVault public constant VAULT = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

  /**
   * @param pool_address - Balancer pool address
   */
  constructor(address pool_address, address[] memory _tokens, address[] memory _oracles, uint256 mul, uint256 div) {
    _priceFeed = IBalancerPool(pool_address);

    registerOracles(_tokens, _oracles);

    _multiply = mul;
    _divide = div;
  }

  function currentValue() external view override returns (uint256) {
    invariantMath();

    bytes32 id = _priceFeed.getPoolId();

    (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = VAULT.getPoolTokens(id);

    uint256 totalValue = sumBalances(tokens, balances);

    return totalValue / _priceFeed.totalSupply();
  }

  function invariantMath() internal view returns (uint256) {
    //BPT Price = 1/(w0^w0 * w1^w1) * invariant * p0^w0 * p1^w1 * BPT supply^-1

    //p0 = 1729825465904068729306 1729.825465904068729306
    //p1 = 1575137344000000000000 1575.137344
    //V = 116541847842842509280324 116541.847842842509280324
    //supply = 113210279768128923680919 113210.279768128923680919

    //BPT Price = 1/(0.5**0.5 * 0.5**0.5)  = 0.70710678118654752440084436210485

    //0.70710678118654752440084436210485 * V == 82,407.53090168475383135468416232
    //p0^w0 = 41.591170528179039569371361271833
    //p1^w1 = 39.688
    //113210.279768128923680919 ^ -1 == 8.8331201798381E−6 ==> 0.0000088331201798381
    //result == 1,201.54875700216
    //ballpark?

    (uint256 V /**uint256 unused */, ) = _priceFeed.getLastInvariant();
    console.log("Got invariant: ", V);
    console.log("Supply: ", _priceFeed.totalSupply());

    //uint256 price = (1e18/(uint256(5e17)**uint256(5e17)));
    //uint256 price = (uint256()**uint256(0.5));

    //console.log("Math done");
    //console.log("1 / weights", price);
    //price = price * V * ()
  }

  function sumBalances(IERC20[] memory tokens, uint256[] memory balances) internal view returns (uint256 total) {
    total = 0;

    console.log("Balances: ", balances.length);
    console.log("token: ", address(tokens[0]), "balance: ", balances[0]); //100615514.12233347 USD
    console.log("token: ", address(tokens[1]), "balance: ", balances[1]); //79835218.30133966 USD += 180,450,732.4233397 USD??

    for (uint256 i = 0; i < tokens.length; i++) {
      total += ((assetOracles[address(tokens[i])].currentValue() * balances[i]));
      console.log(address(tokens[i]), assetOracles[address(tokens[i])].currentValue());
    }
  }

  function registerOracles(address[] memory _tokens, address[] memory _oracles) internal {
    for (uint256 i = 0; i < _tokens.length; i++) {
      assetOracles[_tokens[i]] = IOracleRelay(_oracles[i]);
    }
  }
}
