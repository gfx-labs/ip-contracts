// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../_external/Ownable.sol";
import "./ICurveMaster.sol";
import "./ICurveSlave.sol";

contract CurveMaster is ICurveMaster, Ownable {
    // mapping of token to address
    mapping(address => address) public _curves;
    mapping(address => bool) public _paused;

    constructor() Ownable() {}

    function set_curve(address token_address, address curve_address)
        public
        onlyOwner
    {
        _curves[token_address] = curve_address;
    }

    function get_value_at(address curve_address, int256 x_value)
        external
        view
        override
        returns (int256)
    {
        require(_paused[curve_address] == false, "curve paused");
        require(_curves[curve_address] != address(0x0), "token not enabled");
        ICurveSlave curve = ICurveSlave(_curves[curve_address]);
        int256 value = curve.valueAt(x_value);
        require(value != 0);
        return value;
    }
}
