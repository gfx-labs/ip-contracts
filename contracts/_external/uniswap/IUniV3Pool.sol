// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

import "./pool/IUniswapV3PoolImmutables.sol";
import "./pool/IUniswapV3PoolState.sol";
import "./pool/IUniswapV3PoolDerivedState.sol";
import "./pool/IUniswapV3PoolActions.sol";
import "./pool/IUniswapV3PoolOwnerActions.sol";
import "./pool/IUniswapV3PoolEvents.sol";

/// @title Pool state that is not stored
/// @notice Contains view functions to provide information about the pool that is computed rather than stored on the
/// blockchain. The functions here may have variable gas costs.
interface IUniV3Pool is
  IUniswapV3PoolImmutables,
  IUniswapV3PoolState,
  IUniswapV3PoolDerivedState,
  IUniswapV3PoolActions,
  IUniswapV3PoolOwnerActions,
  IUniswapV3PoolEvents
{

}
