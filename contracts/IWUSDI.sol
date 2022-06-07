// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;
import {IERC20} from "./_external/IERC20.sol";

interface IWUSDI is IERC20 {
  /** view functions */
  function underlying() external view returns (address);
  function totalUnderlying() external view returns (uint256);
  function balanceOfUnderlying(address owner) external view returns (uint256); 
  function underlyingToWrapper(uint256 usdi_amount) external view returns (uint256);
  function wrapperToUnderlying(uint256 wUSDI_amount) external view returns (uint256);

  /** write functions */
  function mint(uint256 wUSDI_amount) external returns (uint256);

  function mintFor(address to, uint256 wUSDI_amount) external returns (uint256);

  function burn(uint256 wUSDI_amount) external returns (uint256);

  function burnTo(address to, uint256 wUSDI_amount) external returns (uint256);

  function burnAll() external returns (uint256);

  function burnAllTo(address to) external returns (uint256);

  function deposit(uint256 usdi_amount) external returns (uint256);

  function depositFor(address to, uint256 usdi_amount) external returns (uint256);

  function withdraw(uint256 usdi_amount) external returns (uint256);

  function withdrawTo(address to, uint256 usdi_amount) external returns (uint256);

  function withdrawAll() external returns (uint256);

  function withdrawAllTo(address to) external returns (uint256);
}
