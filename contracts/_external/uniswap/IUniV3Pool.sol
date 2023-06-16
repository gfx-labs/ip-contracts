// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

interface IUniV3Pool {
  function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external;

  function slot0()
    external
    view
    returns (
      uint160 sqrtPriceX96,
      int24 tick,
      uint16 observationIndex,
      uint16 observationCardinality,
      uint16 observationCardinalityNext,
      uint8 feeProtocol,
      bool unlocked
    );
}
