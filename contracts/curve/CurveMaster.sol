// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../_external/Ownable.sol";
import "./ICurveMaster.sol";
import "./ICurveSlave.sol";

/// @title Curve Master
/// @notice Curve master keeps a record of CurveSlave contracts and links it with an address
/// @dev all numbers should be scaled to 1e18. for instance, number 5e17 represents 50%
contract CurveMaster is ICurveMaster, Ownable {
  // mapping of token to address
  mapping(address => address) public _curves;
  mapping(address => bool) public _paused;

  /// @notice no curves are populated by default
  constructor() Ownable() {}

  /// @notice gets the return value of curve labled curve_address at x_value
  /// @param curve_address the key to lookup the curve with in the mapping
  /// @param x_value the x value to pass to the slave
  /// @return y value of the curve
  function getValueAt(address curve_address, int256 x_value) external view override returns (int256) {
    require(_paused[curve_address] == false, "curve paused");
    require(_curves[curve_address] != address(0x0), "token not enabled");
    ICurveSlave curve = ICurveSlave(_curves[curve_address]);
    int256 value = curve.valueAt(x_value);
    require(value != 0, "result must be nonzero");
    return value;
  }

  function set_curve(address token_address, address curve_address) public override onlyOwner {
    _curves[token_address] = curve_address;
  }
}
