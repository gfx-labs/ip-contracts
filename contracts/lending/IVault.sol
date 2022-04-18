// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVault {
  function BaseLiability() external view returns (uint256);

  function Minter() external view returns (address);

  function tokenBalance(address) external view returns (uint256);

  function withdrawErc20(address token_address, uint256 amount) external;

  function masterTransfer(
    address _token,
    address _to,
    uint256 _amount
  ) external;

  function delegateCompLikeTo(address compLikeDelegatee, address CompLikeToken) external;

  // administrative functions
  function decrease_liability(uint256 base_amount) external returns (uint256);

  function increase_liability(uint256 base_amount) external returns (uint256);
}
