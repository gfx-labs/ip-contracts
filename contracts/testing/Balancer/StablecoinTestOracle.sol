

// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../oracle/IOracleRelay.sol";
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

contract StablecoinTestOracle is IOracleRelay {
  

  function currentValue() external view override returns (uint256) {
    return 1e18;
  }


}
