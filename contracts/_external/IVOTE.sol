// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IVOTE is IERC20 {
  /**
   * @notice Gets the current votes balance for `account`
   * @param account The address to get votes balance
   * @return The number of current votes for `account`
   */
  function getCurrentVotes(address account) external view returns (uint96);
}
