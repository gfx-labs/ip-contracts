//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";

/// @title interfact to interact with ERC20 tokens
/// @author elee

interface IERC20 {
  function mint(address account, uint256 amount) external;

  function totalSupply() external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function transfer(address recipient, uint256 amount) external returns (bool);

  function allowance(address owner, address spender) external view returns (uint256);

  function approve(address spender, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

/// @title Wavepool is the second genration wave contract
// solhint-disable comprehensive-interface
contract RollingWave {
  struct RedemptionData {
    uint256 claimed;
    bool redeemed;
  }

  struct WaveMetadata {
    bytes32 merkleRoot;
    uint128 enableTime;
    uint128 round;
  }

  struct RoundMetaData {
    uint256 roundReward;
    uint128 roundClaimed;
    uint128 impliedPrice;
    uint128 roundFloor;
    uint128 redeemTime;
    bool calculated;
    bool saturation;
  }

  // mapping from wave -> wave information
  // wave informoation includes the merkleRoot and enableTime
  mapping(uint256 => WaveMetadata) public _waveMetaData;

  mapping(uint128 => RoundMetaData) public _roundMetaData;

  // mapping from wave -> address -> claim information
  // claim information includes the amount and whether or not it has been redeemed
  mapping(uint256 => mapping(address => RedemptionData)) public _data;

  // time at which people can claim
  uint128 public _startTime;

  //time between waves
  uint128 public _delay;

  //time between rounds
  uint128 public _roundDelay;

  // the address which will receive any possible extra IPT
  address public _receiver;

  // the token used to claim points, USDC
  IERC20 public _pointsToken; // = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // usdc
  // the token to be rewarded, IPT
  IERC20 public _rewardToken;

  // the amount of reward tokens allocated to the contract
  uint256 public _totalReward;

  // this is the minimum amount of 'points' that can be redeemed for one IPT
  uint256 public _floor;
  // this is the maximum amount of points that can be added to the contract
  uint256 public _cap;

  // the amount of points token that have been sent to the contract
  uint256 public _totalClaimed = 0;

  uint256 public impliedPrice;
  bool public saturation;
  bool public calculated;
  bool public withdrawn;

  event Points(address indexed from, uint256 wave, uint256 amount);

  /**
    each round has 2 waves, and a start time
    run time is delay * 2 (maybe plus some amount)
    wave 1 starts as the round does, wave 2 starts after delay

    when a round completes (second wave is done):
    IPT from that round can be claimed, implied price is saved for that round

    after roundDelay: 
    floor is updated to implied price
    next round starts and process repeats

    if cap is reached, that is the final round

    3 rounds total otherwise
  
   */

  constructor(
    address receiver, //Receive proceeds
    uint256 totalReward, //IPT to sell
    address rewardToken, //IPT
    address pointsToken, //USDC
    uint128 startTime, //time sale starts
    uint128 delay, //time between waves
    uint128 roundDelay, //time between rounds
    bytes32 merkle1, //root for odd number waves
    bytes32 merkle2, //root for even number waves
    uint256 startingFloor //starting floor price
  ) {
    _cap = 500_000 * 35_000_000 * 4;
    _floor = startingFloor;
    _startTime = startTime;
    _delay = delay;
    _roundDelay = roundDelay;
    // reward information
    _rewardToken = IERC20(rewardToken);
    _pointsToken = IERC20(pointsToken);
    _totalReward = totalReward;

    //receiver of proceeds
    _receiver = receiver;

    _setUpWaves(merkle1, merkle2);
    _roundMetaData[1].roundReward = totalReward / 3;
    _roundMetaData[2].roundReward = totalReward / 3;
    _roundMetaData[3].roundReward = totalReward / 3;

    _roundMetaData[1].roundFloor = uint128(startingFloor);
    _roundMetaData[2].roundFloor = uint128(startingFloor);
    _roundMetaData[2].roundFloor = uint128(startingFloor);

    calculated = false;
    saturation = false;
    withdrawn = false;
  }

  function _setUpWaves(bytes32 merkle1, bytes32 merkle2) private {
    //round 1
    _waveMetaData[1].merkleRoot = merkle1;
    _waveMetaData[1].enableTime = _startTime;
    _waveMetaData[1].round = 1;

    _waveMetaData[2].merkleRoot = merkle2;
    _waveMetaData[2].enableTime = _startTime + _delay;
    _waveMetaData[2].round = 1;

    //adjust times
    _startTime = _startTime + _delay + _roundDelay;
    _roundMetaData[1].redeemTime = _startTime;

    //round 2
    _waveMetaData[3].merkleRoot = merkle1;
    _waveMetaData[3].enableTime = _startTime + _delay;
    _waveMetaData[3].round = 2;

    _waveMetaData[4].merkleRoot = merkle2;
    _waveMetaData[4].enableTime = _startTime + _delay;
    _waveMetaData[4].round = 2;

    //adjust times
    _startTime = _startTime + _delay + _roundDelay;
    _roundMetaData[2].redeemTime = _startTime;

    //round 3
    _waveMetaData[5].merkleRoot = merkle1;
    _waveMetaData[5].enableTime = _startTime + _delay;
    _waveMetaData[5].round = 3;

    _waveMetaData[6].merkleRoot = merkle2;
    _waveMetaData[6].enableTime = _startTime + _delay;
    _waveMetaData[6].round = 3;

    _roundMetaData[3].redeemTime = _startTime + _delay + _roundDelay;
  }

  /// @notice tells whether the wave is enabled or not
  /// @return boolean true if the wave is enabled
  function isEnabled(uint256 wave) public view returns (bool) {
    return
      block.timestamp > _waveMetaData[wave].enableTime &&
      block.timestamp < _roundMetaData[_waveMetaData[wave].round].redeemTime;
  }

  /// @notice not claimable after USDC cap has been reached ether for total or for individual round
  function canClaim(uint128 round) public view returns (bool) {
    return
      (_totalClaimed <= _cap) && (_roundMetaData[round].roundClaimed <= (_roundMetaData[round].roundReward / 1e12));
  }

  /// @notice whether or not redemption is possible
  function canRedeem(uint128 round) public view returns (bool) {
    return block.timestamp > _roundMetaData[round].redeemTime;
  }

  /// @notice calculate pricing 1 time for each round to save gas
  function calculatePricing(uint128 round) internal {
    require(!_roundMetaData[round].calculated, "Calculated already");
    // implied price is assuming pro rata, how many points you need for one reward
    // for instance, if the totalReward was 1, and _totalClaimed was below 500_000, then the impliedPrice would be below 500_000
    _roundMetaData[round].impliedPrice = uint128(
      _roundMetaData[round].roundClaimed / (_roundMetaData[round].roundReward / 1e18)
    );
    if (_roundMetaData[round].impliedPrice > _roundMetaData[round].roundFloor) {
      _roundMetaData[round].saturation = true;

      _roundMetaData[round + 1].roundFloor = _roundMetaData[round].impliedPrice;
    }
    _roundMetaData[round].calculated = true;
  }

  /// @notice 1 USDC == 1 point - rewards distributed pro rata based on points
  /// @param amount amount of usdc
  /// @param key the total amount the points the user may claim - ammount allocated in whitelist
  /// @param merkleProof a proof proving that the caller may redeem up to `key` points
  function getPoints(
    uint256 wave,
    uint256 amount,
    uint256 key,
    bytes32[] memory merkleProof
  ) public {
    require(isEnabled(wave) == true, "not enabled");

    uint256 target = _data[wave][msg.sender].claimed + amount;

    require(verifyClaim(wave, msg.sender, key, merkleProof) == true, "invalid proof");

    require(target <= key, "max alloc claimed");

    _data[wave][msg.sender].claimed = target;

    _roundMetaData[_waveMetaData[wave].round].roundClaimed =
      _roundMetaData[_waveMetaData[wave].round].roundClaimed +
      uint128(amount);

    _totalClaimed = _totalClaimed + amount;

    require(canClaim(_waveMetaData[wave].round) == true, "Cap reached");

    takeFrom(msg.sender, amount);
    emit Points(msg.sender, wave, amount);
  }

  /// @notice redeem points for reward token
  /// @param wave if claimed on multiple waves, must redeem for each one separately
  function redeem(uint256 wave) external {
    uint128 round = _waveMetaData[wave].round;
    require(canRedeem(round) == true, "can't redeem yet");
    require(_data[wave][msg.sender].redeemed == false, "already redeem");
    if (!_roundMetaData[round].calculated) {
      calculatePricing(round);
    }
    _data[wave][msg.sender].redeemed = true;
    uint256 rewardAmount;
    RedemptionData memory user = _data[wave][msg.sender];

    if (!_roundMetaData[round].saturation) {
      // if the implied price is smaller than the floor price, that means that
      // not enough points have been claimed to get to the floor price
      // in that case, charge the floor price
      rewardAmount = ((1e18 * user.claimed) / _roundMetaData[round].roundFloor);
    } else {
      // if the implied price is above the floor price, the price is the implied price
      rewardAmount = ((1e18 * user.claimed) / _roundMetaData[round].impliedPrice);
    }
    giveTo(msg.sender, rewardAmount);
  }

  /// @notice function which transfer the point token
  function takeFrom(address target, uint256 amount) internal {
    bool check = _pointsToken.transferFrom(target, _receiver, amount);
    require(check, "erc20 transfer failed");
  }

  /// @notice function which sends the reward token
  function giveTo(address target, uint256 amount) internal {
    if (_rewardToken.balanceOf(address(this)) < amount) {
      amount = _rewardToken.balanceOf(address(this));
    }
    require(amount > 0, "cant redeem zero");
    bool check = _rewardToken.transfer(target, amount);
    require(check, "erc20 transfer failed");
  }

  /// @notice validate the proof of a merkle drop claim
  /// @param wave the wave that they are trying to redeem for
  /// @param claimer the address attempting to claim
  /// @param key the amount of scaled TRIBE allocated the claimer claims that they have credit over
  /// @param merkleProof a proof proving that claimer may redeem up to `key` amount of tribe
  /// @return boolean true if the proof is valid, false if the proof is invalid
  function verifyClaim(
    uint256 wave,
    address claimer,
    uint256 key,
    bytes32[] memory merkleProof
  ) private view returns (bool) {
    bytes32 leaf = keccak256(abi.encodePacked(claimer, key));
    bytes32 merkleRoot = _waveMetaData[wave].merkleRoot;
    return verifyProof(merkleProof, merkleRoot, leaf);
  }

  //solhint-disable-next-line max-line-length
  //merkle logic: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/c9bdb1f0ae168e00a942270f2b85d6a7d3293550/contracts/utils/cryptography/MerkleProof.sol
  //MIT: OpenZeppelin Contracts v4.3.2 (utils/cryptography/MerkleProof.sol)
  function verifyProof(
    bytes32[] memory proof,
    bytes32 root,
    bytes32 leaf
  ) internal pure returns (bool) {
    return processProof(proof, leaf) == root;
  }

  function processProof(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32) {
    bytes32 computedHash = leaf;
    for (uint256 i = 0; i < proof.length; i++) {
      bytes32 proofElement = proof[i];
      if (computedHash <= proofElement) {
        computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
      } else {
        computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
      }
    }
    return computedHash;
  }
} // solhint-enable comprehensive-interface
