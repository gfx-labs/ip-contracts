// SPDX-License-Identifier: MIT
/* solhint-disable */
pragma solidity 0.8.9;

import "../_external/ERC20Detailed.sol";

import "../_external/openzeppelin/OwnableUpgradeable.sol";
import "../_external/openzeppelin/Initializable.sol";

/**
 * @title uFragments ERC20 token
 * @dev USDI uses the uFragments concept from the Ideal Money project to play interest
 *      Implementation is shamelessly borrowed from Ampleforth project
 *      uFragments is a normal ERC20 token, but its supply can be adjusted by splitting and
 *      combining tokens proportionally across all wallets.
 *
 *
 *      uFragment balances are internally represented with a hidden denomination, 'gons'.
 *      We support splitting the currency in expansion and combining the currency on contraction by
 *      changing the exchange rate between the hidden 'gons' and the public 'fragments'.
 */
contract UFragments is Initializable, OwnableUpgradeable, ERC20Detailed {
  // PLEASE READ BEFORE CHANGING ANY ACCOUNTING OR MATH
  // Anytime there is division, there is a risk of numerical instability from rounding errors. In
  // order to minimize this risk, we adhere to the following guidelines:
  // 1) The conversion rate adopted is the number of gons that equals 1 fragment.
  //    The inverse rate must not be used--_totalGons is always the numerator and _totalSupply is
  //    always the denominator. (i.e. If you want to convert gons to fragments instead of
  //    multiplying by the inverse rate, you should divide by the normal rate)
  // 2) Gon balances converted into Fragments are always rounded down (truncated).
  //
  // We make the following guarantees:
  // - If address 'A' transfers x Fragments to address 'B'. A's resulting external balance will
  //   be decreased by precisely x Fragments, and B's external balance will be precisely
  //   increased by x Fragments.
  //
  // We do not guarantee that the sum of all balances equals the result of calling totalSupply().
  // This is because, for any conversion function 'f()' that has non-zero rounding error,
  // f(x0) + f(x1) + ... + f(xn) is not always equal to f(x0 + x1 + ... xn).

  event LogRebase(uint256 indexed epoch, uint256 totalSupply);
  event LogMonetaryPolicyUpdated(address monetaryPolicy);

  // Used for authentication
  address public monetaryPolicy;

  modifier onlyMonetaryPolicy() {
    require(msg.sender == monetaryPolicy);
    _;
  }

  modifier validRecipient(address to) {
    require(to != address(0x0));
    require(to != address(this));
    _;
  }

  uint256 private constant DECIMALS = 18;
  uint256 private constant MAX_UINT256 = 2 ** 256 - 1;
  uint256 private constant INITIAL_FRAGMENTS_SUPPLY = 1 * 10 ** DECIMALS;

  // _totalGons is a multiple of INITIAL_FRAGMENTS_SUPPLY so that _gonsPerFragment is an integer.
  // Use the highest value that fits in a uint256 for max granularity.
  uint256 public _totalGons; // = INITIAL_FRAGMENTS_SUPPLY * 10**48;

  // MAX_SUPPLY = maximum integer < (sqrt(4*_totalGons + 1) - 1) / 2
  uint256 public MAX_SUPPLY; // = type(uint128).max; // (2^128) - 1

  uint256 public _totalSupply;
  uint256 public _gonsPerFragment;
  mapping(address => uint256) public _gonBalances;

  // This is denominated in Fragments, because the gons-fragments conversion might change before
  // it's fully paid.
  mapping(address => mapping(address => uint256)) private _allowedFragments;

  // EIP-2612: permit – 712-signed approvals
  // https://eips.ethereum.org/EIPS/eip-2612
  string public constant EIP712_REVISION = "1";
  bytes32 public constant EIP712_DOMAIN =
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
  bytes32 public constant PERMIT_TYPEHASH =
    keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

  // EIP-2612: keeps track of number of permits per address
  mapping(address => uint256) private _nonces;

  function __UFragments_init(string memory name, string memory symbol) public initializer {
    __Ownable_init();
    __ERC20Detailed_init(name, symbol, uint8(DECIMALS));

    //set og initial values
    _totalGons = INITIAL_FRAGMENTS_SUPPLY * 10 ** 48;
    MAX_SUPPLY = 2 ** 128 - 1;

    _totalSupply = INITIAL_FRAGMENTS_SUPPLY;
    _gonBalances[address(0x0)] = _totalGons; //send starting supply to a burner address so _totalSupply is never 0
    _gonsPerFragment = _totalGons / _totalSupply;

    emit Transfer(address(this), address(0x0), _totalSupply);
  }

  /**
   * @param monetaryPolicy_ The address of the monetary policy contract to use for authentication.
   */
  function setMonetaryPolicy(address monetaryPolicy_) external onlyOwner {
    monetaryPolicy = monetaryPolicy_;
    emit LogMonetaryPolicyUpdated(monetaryPolicy_);
  }

  /**
   * @return The total number of fragments.
   */
  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  /**
   * @param who The address to query.
   * @return The balance of the specified address.
   */
  function balanceOf(address who) external view override returns (uint256) {
    return _gonBalances[who] / _gonsPerFragment;
  }

  /**
   * @param who The address to query.
   * @return The gon balance of the specified address.
   */
  function scaledBalanceOf(address who) external view returns (uint256) {
    return _gonBalances[who];
  }

  /**
   * @return the total number of gons.
   */
  function scaledTotalSupply() external view returns (uint256) {
    return _totalGons;
  }

  /**
   * @return The number of successful permits by the specified address.
   */
  function nonces(address who) public view returns (uint256) {
    return _nonces[who];
  }

  /**
   * @return The computed DOMAIN_SEPARATOR to be used off-chain services
   *         which implement EIP-712.
   *         https://eips.ethereum.org/EIPS/eip-2612
   */
  function DOMAIN_SEPARATOR() public view returns (bytes32) {
    uint256 chainId;
    assembly {
      chainId := chainid()
    }
    return
      keccak256(
        abi.encode(EIP712_DOMAIN, keccak256(bytes(name())), keccak256(bytes(EIP712_REVISION)), chainId, address(this))
      );
  }

  /**
   * @dev Transfer tokens to a specified address.
   * @param to The address to transfer to.
   * @param value The amount to be transferred.
   * @return True on success, false otherwise.
   */
  function transfer(address to, uint256 value) external override validRecipient(to) returns (bool) {
    uint256 gonValue = value * _gonsPerFragment;

    _gonBalances[msg.sender] = _gonBalances[msg.sender] - gonValue;
    _gonBalances[to] = _gonBalances[to] + gonValue;

    emit Transfer(msg.sender, to, value);
    return true;
  }

  /**
   * @dev Transfer all of the sender's wallet balance to a specified address.
   * @param to The address to transfer to.
   * @return True on success, false otherwise.
   */
  function transferAll(address to) external validRecipient(to) returns (bool) {
    uint256 gonValue = _gonBalances[msg.sender];
    uint256 value = gonValue / _gonsPerFragment;

    delete _gonBalances[msg.sender];
    _gonBalances[to] = _gonBalances[to] + gonValue;

    emit Transfer(msg.sender, to, value);
    return true;
  }

  /**
   * @dev Function to check the amount of tokens that an owner has allowed to a spender.
   * @param owner_ The address which owns the funds.
   * @param spender The address which will spend the funds.
   * @return The number of tokens still available for the spender.
   */
  function allowance(address owner_, address spender) external view override returns (uint256) {
    return _allowedFragments[owner_][spender];
  }

  /**
   * @dev Transfer tokens from one address to another.
   * @param from The address you want to send tokens from.
   * @param to The address you want to transfer to.
   * @param value The amount of tokens to be transferred.
   */
  function transferFrom(address from, address to, uint256 value) external override validRecipient(to) returns (bool) {
    _allowedFragments[from][msg.sender] = _allowedFragments[from][msg.sender] - value;

    uint256 gonValue = value * _gonsPerFragment;
    _gonBalances[from] = _gonBalances[from] - gonValue;
    _gonBalances[to] = _gonBalances[to] + gonValue;

    emit Transfer(from, to, value);
    return true;
  }

  /**
   * @dev Transfer all balance tokens from one address to another.
   * @param from The address you want to send tokens from.
   * @param to The address you want to transfer to.
   */
  function transferAllFrom(address from, address to) external validRecipient(to) returns (bool) {
    uint256 gonValue = _gonBalances[from];
    uint256 value = gonValue / _gonsPerFragment;

    _allowedFragments[from][msg.sender] = _allowedFragments[from][msg.sender] - value;

    delete _gonBalances[from];
    _gonBalances[to] = _gonBalances[to] + gonValue;

    emit Transfer(from, to, value);
    return true;
  }

  /**
   * @dev Approve the passed address to spend the specified amount of tokens on behalf of
   * msg.sender. This method is included for ERC20 compatibility.
   * increaseAllowance and decreaseAllowance should be used instead.
   * Changing an allowance with this method brings the risk that someone may transfer both
   * the old and the new allowance - if they are both greater than zero - if a transfer
   * transaction is mined before the later approve() call is mined.
   *
   * @param spender The address which will spend the funds.
   * @param value The amount of tokens to be spent.
   */
  function approve(address spender, uint256 value) external override returns (bool) {
    _allowedFragments[msg.sender][spender] = value;

    emit Approval(msg.sender, spender, value);
    return true;
  }

  /**
   * @dev Increase the amount of tokens that an owner has allowed to a spender.
   * This method should be used instead of approve() to avoid the double approval vulnerability
   * described above.
   * @param spender The address which will spend the funds.
   * @param addedValue The amount of tokens to increase the allowance by.
   */
  function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
    _allowedFragments[msg.sender][spender] = _allowedFragments[msg.sender][spender] + addedValue;

    emit Approval(msg.sender, spender, _allowedFragments[msg.sender][spender]);
    return true;
  }

  /**
   * @dev Decrease the amount of tokens that an owner has allowed to a spender.
   *
   * @param spender The address which will spend the funds.
   * @param subtractedValue The amount of tokens to decrease the allowance by.
   */
  function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
    uint256 oldValue = _allowedFragments[msg.sender][spender];
    _allowedFragments[msg.sender][spender] = (subtractedValue >= oldValue) ? 0 : oldValue - subtractedValue;

    emit Approval(msg.sender, spender, _allowedFragments[msg.sender][spender]);
    return true;
  }

  /**
   * @dev Allows for approvals to be made via secp256k1 signatures.
   * @param owner The owner of the funds
   * @param spender The spender
   * @param value The amount
   * @param deadline The deadline timestamp, type(uint256).max for max deadline
   * @param v Signature param
   * @param s Signature param
   * @param r Signature param
   */
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public {
    require(block.timestamp <= deadline);

    uint256 ownerNonce = _nonces[owner];
    bytes32 permitDataDigest = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, ownerNonce, deadline));
    bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), permitDataDigest));

    require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Invalid signature");
    require(owner == ecrecover(digest, v, r, s));
    require(owner != address(0x0), "Invalid signature");

    _nonces[owner] = ownerNonce + 1;

    _allowedFragments[owner][spender] = value;
    emit Approval(owner, spender, value);
  }
}
/* solhint-enable */
