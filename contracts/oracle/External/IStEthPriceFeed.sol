// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IStEthPriceFeed {
  function initialize(
    uint256 max_safe_price_difference,
    address stable_swap_oracle_address,
    address curve_pool_address,
    address admin
  ) external;

  function safe_price() external view returns (uint256, uint256);

  function current_price() external view returns (uint256, bool);

  function update_safe_price() external returns (uint256);

  function fetch_safe_price(uint256 max_age) external returns (uint256, uint256);

  function set_admin(address admin) external;

  function set_max_safe_price_difference(uint256 max_safe_price_difference) external;

  function admin() external view returns (address);

  function max_safe_price_difference() external view returns (uint256);

  function safe_price_value() external view returns (uint256);

  function safe_price_timestamp() external view returns (uint256);

  function curve_pool_address() external view returns (address);

  function stable_swap_oracle_address() external view returns (address);
}
