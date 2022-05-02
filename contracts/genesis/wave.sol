//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title interfact to interact with ERC20 tokens
/// @author elee
interface IERC20 {
    function mint(address account, uint256 amount) external;

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

/// @title Contract for IDO
contract Wave {
    IERC20 public constant pointsToken =
        IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // usdc

    IERC20 public constant rewardToken =
        IERC20(address(0)); // ipt

    mapping(address => uint256) public claimed;
    mapping(address => bool) public redeemed;

    bytes32 public merkleRoot =
        0x0000000000000000000000000000000000000000000000000000000000000000;

    uint256 public _totalClaimed;
    uint256 public _totalReward;
    uint256 public _enableTime;
    uint256 public _disableTime;
    uint256 public _floor;
    address public _receiver;
    event Points(address indexed from, uint256 amount);

    constructor(bytes32 root, uint256 totalReward, uint256 floor, uint256 enableTime, uint256 disableTime, address receiver ) {
        _enableTime = enableTime;
        _disableTime = disableTime;
        _floor = floor;
        _totalClaimed = totalReward;
        _receiver = receiver;
        merkleRoot = root;
    }

    /// @notice redeem points for token
    function redeem() external {
        require(canRedeem() == true, "cant redeem yet");
        require(redeemed[msg.sender] == false,"already redeem");
        redeemed[msg.sender] = true;
        uint256 rewardAmount;
        // totalClaimed is in points, so we multiply it by 1e12
        if(_totalClaimed * 1e12 > _totalReward){
            // remember that _totalClaimed is in points, so we must multiply by 1e12 to get the correct decimal count
            // ratio is less than 1e18, it is a percentage in 1e18 terms
            uint256 ratio = _totalReward * 1e18 / (_totalClaimed * 1e12); 
            // that ratio is how many rewardToken each point entitles the redeemer
            // so multiply the senders points by the ratio and divide by 1e18
            rewardAmount = claimed[msg.sender] * ratio / 1e18;
        }else{
            // multiply amount claimed by the floor price, then divide. 
            // for instance, if the _floor is 500_000, then the redeemer will obtain 0.5 rewardToken per pointToken
            rewardAmount = claimed[msg.sender] * _floor / (1_000_000);
        }
        // scale the decimals and send money
        giveTo(msg.sender, rewardAmount * 1e12);
    }

    /// @notice get points
    /// @param amount amount of usdc
    /// @param key the total amount the points the user may claim
    /// @param merkleProof a proof proving that the caller may redeem up to `key` points 
    function getPoints(
        uint256 amount,
        uint256 key,
        bytes32[] memory merkleProof
    ) public {
        require(isEnabled() == true, "not enabled");
        address thisSender = msg.sender;
        require(
            verifyClaim(thisSender, key, merkleProof) == true,
            "invalid proof"
        );
        require((claimed[thisSender] + amount) <= key,"max alloc claimed");
        claimed[thisSender] = claimed[thisSender] + amount;
        _totalClaimed = _totalClaimed + amount;
        takeFrom(thisSender, amount);
        emit Points(thisSender, amount);
    }

    /// @notice validate the proof of a merkle drop claim
    /// @param claimer the address attempting to claim
    /// @param key the amount of scaled TRIBE allocated the claimer claims that they have credit over
    /// @param merkleProof a proof proving that claimer may redeem up to `key` amount of tribe
    /// @return boolean true if the proof is valid, false if the proof is invalid
    function verifyClaim(
        address claimer,
        uint256 key,
        bytes32[] memory merkleProof
    ) private view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(claimer, key));
        return verifyProof(merkleProof, merkleRoot, leaf);
    }

    //merkle logic: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/c9bdb1f0ae168e00a942270f2b85d6a7d3293550/contracts/utils/cryptography/MerkleProof.sol
    //MIT: OpenZeppelin Contracts v4.3.2 (utils/cryptography/MerkleProof.sol)
    function verifyProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        return processProof(proof, leaf) == root;
    }

    function processProof(bytes32[] memory proof, bytes32 leaf)
        internal
        pure
        returns (bytes32)
    {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(
                    abi.encodePacked(computedHash, proofElement)
                );
            } else {
                computedHash = keccak256(
                    abi.encodePacked(proofElement, computedHash)
                );
            }
        }
        return computedHash;
    }

    //end

    /// @notice function which transfer the point token
    function takeFrom(address target, uint256 amount) internal {
        bool check = pointsToken.transferFrom(target, _receiver, amount);
        require(check, "erc20 transfer failed");
    }

    /// @notice function which sends the reward token
    function giveTo(address target, uint256 amount) internal {
        bool check = rewardToken.transferFrom(address(this),target, amount);
        require(check, "erc20 transfer failed");
    }

    /// @notice tells whether or not both parties have accepted the deal
    /// @return boolean true if both parties have accepted, else false
    function isEnabled() public view returns (bool) {
        return block.timestamp > _enableTime && block.timestamp < _disableTime;
    }

    /// @notice whether or not the wave has completed
    function canRedeem() public view returns (bool) {
        return block.timestamp > _disableTime;
    }

}