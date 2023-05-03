// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../_external/uniswap/INonfungiblePositionManager.sol";

import "hardhat/console.sol";

contract TestContract {


  function doTheMint(INonfungiblePositionManager.MintParams calldata params) external {

    INonfungiblePositionManager nfp = INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    console.log("MINTING");
    console.log("BlockNum: ", block.number);
    console.log("Deadline: ", params.deadline);

    nfp.mint(params);
  }
}
