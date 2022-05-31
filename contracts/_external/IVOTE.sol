// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./IERC20.sol";

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IVOTE is IERC20 {
  enum DelegationType {
    VOTING_POWER,
    PROPOSITION_POWER
  }

  /**
   * @notice Gets the current votes balance for `account`
   * @param account The address to get votes balance
   * @return The number of current votes for `account`
   */
  function getCurrentVotes(address account) external view returns (uint96);

  /**
   * @dev returns the current delegated power of a user. The current power is the
   * power delegated at the time of the last snapshot
   * @param user the user
   **/
  function getPowerCurrent(address user, DelegationType delegationType) external view returns (uint256);

  function getVotes(address account) external view returns (uint256);
}
