pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./GovernorCharlieInterfaces.sol";

contract GovernorCharlieDelegator is GovernorCharlieDelegatorStorage, GovernorCharlieEvents {
	constructor(
			address ipt_,
	        address implementation_,
	        uint votingPeriod_,
	        uint votingDelay_,
            uint proposalThreshold_,
            uint delay_, 
            uint emergencyQuorumVotes_,
            uint quorumVotes_,
            uint emergencyVotingPeriod_) public {

        delegateTo(implementation_, abi.encodeWithSignature("initialize(address,uint256,uint256,uint256)",
                                                            ipt_,
                                                            votingPeriod_,
                                                            votingDelay_,
                                                            proposalThreshold_,
                                                            delay_,
                                                            emergencyQuorumVotes_,
                                                            quorumVotes_,
                                                            emergencyVotingPeriod_,
                                                            emergencyDelay_));

        _setImplementation(implementation_);
	}


	/**
     * @notice Called by itself via governance to update the implementation of the delegator
     * @param implementation_ The address of the new implementation for delegation
     */
    function _setImplementation(address implementation_) public {
        require(msg.sender == address(this), "GovernorCharlieDelegator::_setImplementation: can only be changed by calling itself");
        require(implementation_ != address(0), "GovernorCharlieDelegator::_setImplementation: invalid implementation address");

        address oldImplementation = implementation;
        implementation = implementation_;

        emit NewImplementation(oldImplementation, implementation);
    }

    /**
     * @notice Internal method to delegate execution to another contract
     * @dev It returns to the external caller whatever the implementation returns or forwards reverts
     * @param callee The contract to delegatecall
     * @param data The raw data to delegatecall
     */
    function delegateTo(address callee, bytes memory data) internal {
        (bool success, bytes memory returnData) = callee.delegatecall(data);
        assembly {
            if eq(success, 0) {
                revert(add(returnData, 0x20), returndatasize)
            }
        }
    }

	/**
     * @dev Delegates execution to an implementation contract.
     * It returns to the external caller whatever the implementation returns
     * or forwards reverts.
     */
    function () external payable {
        // delegate all other functions to current implementation
        (bool success, ) = implementation.delegatecall(msg.data);

        assembly {
              let free_mem_ptr := mload(0x40)
              returndatacopy(free_mem_ptr, 0, returndatasize)

              switch success
              case 0 { revert(free_mem_ptr, returndatasize) }
              default { return(free_mem_ptr, returndatasize) }
        }
    }
}