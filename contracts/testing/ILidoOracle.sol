// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../_external/IERC20Metadata.sol";

interface ILidoOracle is IERC20Metadata {
    
  function reportBeacon(
    uint256 _epochId,
    uint64 _beaconBalance,
    uint32 _beaconValidators
  ) external;
}
