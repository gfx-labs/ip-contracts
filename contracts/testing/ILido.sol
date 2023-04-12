// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../_external/IERC20Metadata.sol";

interface ILido is IERC20Metadata {
  function depositBufferedEther() external;

  function submit(address _referral) external payable returns (uint256);

  function getOracle() external view returns (address);
}
