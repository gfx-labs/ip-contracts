// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

library ArrayMutation {
  ///@param idx the element to remove from @param inputArray
  function removeFromArray(uint idx, uint256[] memory inputArray) internal pure returns (uint256[] memory newList) {
    //if length == 0, return false / revert?
    require(inputArray.length > 0, "inputArray length == 0");

    //if length == 1, reset to empty array
    if (inputArray.length == 1) {
      return new uint256[](0);
    }

    uint256 finalElement = inputArray[inputArray.length - 1];

    //if final element == deleted element, simply return the array minus the final element
    if (finalElement == inputArray[idx]) {
      newList = new uint256[](inputArray.length - 1);
      for (uint k = 0; k < newList.length; k++) {
        newList[k] = inputArray[k];
      }

      return newList;
    }

    //if not the final element, replace the withdrawn idx with the final element
    inputArray[idx] = finalElement;

    newList = new uint256[](inputArray.length - 1);
    for (uint j = 0; j < newList.length; j++) {
      newList[j] = inputArray[j];
    }
    return newList;
  }
}
