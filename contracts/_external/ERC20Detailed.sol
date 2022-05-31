//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import "./IERC20.sol";
import "./openzeppelin/Initializable.sol";

/**
 * @title ERC20Detailed token
 * @dev The decimals are only for visualization purposes.
 * All the operations are done using the smallest and indivisible token unit,
 * just as on Ethereum all the operations are done in wei.
 */
abstract contract ERC20Detailed is Initializable, IERC20 {
  string private _name;
  string private _symbol;
  uint8 private _decimals;

  /**
    constructor(string memory name_, string memory symbol_, uint8 decimals_){
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }
     */

  function __ERC20Detailed_init(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) public initializer {
    _name = name_;
    _symbol = symbol_;
    _decimals = decimals_;
  }

  /**
   * @return the name of the token.
   */
  function name() public view virtual returns (string memory) {
    return _name;
  }

  /**
   * @return the symbol of the token.
   */
  function symbol() public view virtual returns (string memory) {
    return _symbol;
  }

  /**
   * @return the number of decimals of the token.
   */
  function decimals() public view virtual returns (uint8) {
    return _decimals;
  }

  uint256[50] private ______gap;
}
