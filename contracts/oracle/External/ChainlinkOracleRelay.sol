// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IOracleRelay.sol";
import "../../_external/chainlink/IAggregator.sol";

contract ChainlinkOracleRelay is IOracleRelay {
    address public _feedAddress;
    IAggregator private _aggregator;

    uint256 public _multiply;
    uint256 public _divide;

    constructor(
        address feed_address,
        uint256 mul,
        uint256 div
    ) {
        _feedAddress = feed_address;
        _aggregator = IAggregator(feed_address);
        _multiply = mul;
        _divide = div;
    }

    function currentValue() external view override returns (uint256) {
        return getLastSecond();
    }

    function getLastSecond() private view returns (uint256) {
        int256 latest = _aggregator.latestAnswer();
        require(latest > 0, "chainlink oracle reported price below 0");
        uint256 scaled = (uint256(latest) * _multiply) / _divide;
        return scaled;
    }
}
