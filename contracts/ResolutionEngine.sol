/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {RBACed} from "./RBACed.sol";
import {Oracle} from "./Oracle.sol";
import {BountyFund} from "./BountyFund.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

library VerificationPhaseLib {
    using SafeMath for uint256;

    enum State {Unopened, Opened, Closed}

    struct VerificationPhase {
        State state;

        mapping(bool => uint256) statusAmountMap;

        mapping(address => bool) walletStakedMap;
        uint256 stakingWallets;

        mapping(address => uint256) walletAmountMap;
        mapping(uint256 => uint256) blockAmountMap;

        uint256 bounty;
        uint256 startBlock;
        uint256 endBlock;
    }

    function open(VerificationPhase storage _phase, uint256 _bounty) internal {
        _phase.state = State.Opened;
        _phase.bounty = _bounty;
        _phase.startBlock = block.number;
    }

    function close(VerificationPhase storage _phase) internal {
        _phase.state = State.Closed;
        _phase.endBlock = block.number;
    }

    function stake(VerificationPhase storage _phase, address _wallet,
        bool _status, uint256 _amount) internal {

        _phase.statusAmountMap[_status] = _phase.statusAmountMap[_status].add(_amount);

        if (!_phase.walletStakedMap[_wallet]) {
            _phase.walletStakedMap[_wallet] = true;
            _phase.stakingWallets++;
        }

        _phase.walletAmountMap[_wallet] = _phase.walletAmountMap[_wallet].add(_amount);
        _phase.blockAmountMap[block.number] = _phase.blockAmountMap[block.number].add(_amount);
    }
}

/// @title ResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine base contract
contract ResolutionEngine is RBACed {
    using SafeMath for uint256;
    using VerificationPhaseLib for VerificationPhaseLib.VerificationPhase;

    event OracleSet(address indexed _oracle);
    event TokenSet(address indexed _token);
    event BountyFundSet(address indexed _bountyFund);
    event BountyFractionSet(uint256 indexed _bountyFraction);
    event TokensStaked(uint256 indexed _verificationPhaseNumber, address indexed _wallet, bool _status, uint256 _amount);
    event VerificationPhaseOpened(uint256 indexed _verificationPhaseNumber);
    event VerificationPhaseClosed(uint256 indexed _verificationPhaseNumber);

    string constant public ORACLE_ROLE = "ORACLE";

    Oracle public oracle;
    ERC20 public token;
    BountyFund public bountyFund;
    uint256 public bountyFraction;

    uint256 public verificationPhaseNumber;
    mapping(uint256 => VerificationPhaseLib.VerificationPhase) private verificationPhaseMap;
    mapping(address => uint256) private walletAmountMap;
    mapping(uint256 => uint256) private blockAmountMap;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _oracle, address _token) public {
        // Initialize oracle
        oracle = Oracle(_oracle);

        // Initialize token
        token = ERC20(_token);

        // Update oracle role based access
        addRoleInternal(ORACLE_ROLE);
        addRoleAccessorInternal(ORACLE_ROLE, _oracle);
    }

    modifier onlyCurrentPhaseNumber(uint256 _verificationPhaseNumber) {
        require(verificationPhaseNumber == _verificationPhaseNumber);
        _;
    }

    modifier onlyCurrentOrEarlierPhaseNumber(uint256 _verificationPhaseNumber) {
        require(verificationPhaseNumber >= _verificationPhaseNumber);
        _;
    }

    modifier onlyCurrentOrEarlierBlockNumber(uint256 _blockNumber) {
        require(block.number >= _blockNumber);
        _;
    }

    /// @notice Set the bounty fund of this resolution engine
    /// @dev This function can only be called once
    /// @param _bountyFund The address of the concerned bounty fund
    function setBountyFund(address _bountyFund) public {
        require(address(0) == address(bountyFund));

        // Update bounty fund
        bountyFund = BountyFund(_bountyFund);

        // Emit event
        emit BountyFundSet(_bountyFund);
    }

    /// @notice Set the bounty fraction of this resolution engine
    /// @dev This requires the presence of bounty fund and can only be called once
    /// @param _bountyFraction The concerned bounty fraction, which must be less than bounty fund's entirety value
    function setBountyFraction(uint256 _bountyFraction) public {
        // Require that bounty fund has been set and concerned bounty fraction is not greater than entirety
        require(address(0) != address(bountyFund));
        require(_bountyFraction <= bountyFund.PARTS_PER());

        // Require that bounty fraction has not previously been set
        require(0 == bountyFraction);

        // Update bounty fraction
        bountyFraction = _bountyFraction;

        // Emit event
        emit BountyFractionSet(_bountyFraction);
    }

    /// @notice For the current phase number stake the amount of tokens at the given status
    /// @dev Client has to do prior approval of the transfer of the given amount. The function can only
    /// be called by oracle.
    /// @param _wallet The concerned wallet
    /// @param _verificationPhaseNumber The verification phase number to stake into, which can only be
    /// the current verification phase number
    /// @param _status The status staked at
    /// @param _amount The amount staked
    function stakeTokens(address _wallet, uint256 _verificationPhaseNumber, bool _status, uint256 _amount)
    public
    onlyRoleAccessor(ORACLE_ROLE)
    onlyCurrentPhaseNumber(_verificationPhaseNumber)
    {
        // Transfer tokens to this
        token.transferFrom(_wallet, this, _amount);

        // Update metrics
        verificationPhaseMap[_verificationPhaseNumber].stake(_wallet, _status, _amount);
        walletAmountMap[_wallet] = walletAmountMap[_wallet].add(_amount);
        blockAmountMap[block.number] = blockAmountMap[block.number].add(_amount);

        // Emit event
        emit TokensStaked(_verificationPhaseNumber, _wallet, _status, _amount);
    }

    /// @notice Get the metrics for the given verification phase number
    /// @dev Reverts if provided verification phase number is higher than current verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    function metricsByVerificationPhaseNumber(uint256 _verificationPhaseNumber)
    public
    view
    onlyCurrentOrEarlierPhaseNumber(_verificationPhaseNumber)
    returns (VerificationPhaseLib.State state, uint256 trueAmount, uint256 falseAmount,
        uint256 amount, uint256 numberOfWallets, uint256 startBlock,
        uint256 endBlock, uint256 numberOfBlocks, uint256 bounty)
    {
        state = verificationPhaseMap[_verificationPhaseNumber].state;
        trueAmount = verificationPhaseMap[_verificationPhaseNumber].statusAmountMap[true];
        falseAmount = verificationPhaseMap[_verificationPhaseNumber].statusAmountMap[false];
        amount = trueAmount.add(falseAmount);
        numberOfWallets = verificationPhaseMap[_verificationPhaseNumber].stakingWallets;
        startBlock = verificationPhaseMap[_verificationPhaseNumber].startBlock;
        endBlock = verificationPhaseMap[_verificationPhaseNumber].endBlock;
        numberOfBlocks = (endBlock == 0 ? block.number : endBlock) - startBlock;
        bounty = verificationPhaseMap[_verificationPhaseNumber].bounty;
    }

    /// @notice Get the metrics for the given verification phase number and wallet
    /// @dev Reverts if provided verification phase number is higher than current verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @param _wallet The address of the concerned wallet
    function metricsByVerificationPhaseNumberAndWallet(uint256 _verificationPhaseNumber, address _wallet)
    public
    view
    onlyCurrentOrEarlierPhaseNumber(_verificationPhaseNumber)
    returns (uint256 amount)
    {
        amount = verificationPhaseMap[_verificationPhaseNumber].walletAmountMap[_wallet];
    }

    /// @notice Get the metrics for the wallet
    /// @param _wallet The address of the concerned wallet
    function metricsByWallet(address _wallet)
    public
    view
    returns (uint256 amount)
    {
        amount = walletAmountMap[_wallet];
    }

    /// @notice Get the metrics for the block
    /// @dev Reverts if provided block number is higher than current block number
    /// @param _blockNumber The concerned block number
    function metricsByBlockNumber(uint256 _blockNumber)
    public
    view
    onlyCurrentOrEarlierBlockNumber(_blockNumber)
    returns (uint256 amount)
    {
        amount = blockAmountMap[_blockNumber];
    }

    /// @notice Open verification phase
    function openVerificationPhase() internal {
        // Require that verification phase is not open
        require(verificationPhaseMap[verificationPhaseNumber].state == VerificationPhaseLib.State.Unopened);

        // Withdraw from bounty fund
        uint256 bountyAmount = bountyFund.withdrawTokens(bountyFraction);

        // Open the verification phase
        verificationPhaseMap[verificationPhaseNumber].open(bountyAmount);

        // Emit event
        emit VerificationPhaseOpened(verificationPhaseNumber);
    }

    /// @notice Close verification phase
    function closeVerificationPhase() internal {
        // Require that verification phase is open
        require(verificationPhaseMap[verificationPhaseNumber].state == VerificationPhaseLib.State.Opened);

        // Close the verification phase
        verificationPhaseMap[verificationPhaseNumber].close();

        // Emit event
        emit VerificationPhaseClosed(verificationPhaseNumber);

        // Bump verification phase number
        verificationPhaseNumber++;
    }
}
