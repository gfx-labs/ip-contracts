// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IOracleRelay.sol";

contract AnchoredViewRelay is IOracleRelay {
    address public _anchorAddress;
    IOracleRelay public _anchorRelay;

    address public _mainAddress;
    IOracleRelay public _mainRelay;

    uint256 public _widthNumerator;
    uint256 public _widthDenominator;

    constructor(
        address anchor_address,
        address main_address,
        uint256 widthNumerator,
        uint256 widthDenominator
    ) {
        _anchorAddress = anchor_address;
        _anchorRelay = IOracleRelay(anchor_address);

        _mainAddress = main_address;
        _mainRelay = IOracleRelay(main_address);

        _widthNumerator = widthNumerator;
        _widthDenominator = widthDenominator;
    }

    function currentValue() external view override returns (uint256) {
        return getLastSecond();
    }

    function getLastSecond() private view returns (uint256) {
        // get the main price
        uint256 mainValue = _mainRelay.currentValue();
        require(mainValue > 0, "invalid oracle value");

        // get anchor price
        uint256 anchorPrice = _anchorRelay.currentValue();
        require(anchorPrice > 0, "invalid anchor value");

        // calculate buffer
        uint256 buffer = (_widthNumerator * anchorPrice) / _widthDenominator;

        // create upper and lower bounder
        uint256 upperBounds = anchorPrice + buffer;
        uint256 lowerBounds = anchorPrice - buffer;

        // ensure
        require(mainValue < upperBounds, "anchor too high");
        require(mainValue > lowerBounds, "anchor too low");

        // return mainValue
        return mainValue;
    }
}
