// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IGauge {

    function deposit(uint256 _value) external;

    function withdraw(uint256 _value) external;

    function withdraw(uint256 _value, bool _claim_rewards) external;

    function claim_rewards() external;

    function claim_rewards(address _addr) external;

    function claim_rewards(address _addr, address _receiver) external;

}
