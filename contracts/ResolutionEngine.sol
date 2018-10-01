/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {Resolvable} from "./Resolvable.sol";
import {RBACed} from "./RBACed.sol";
import {Oracle} from "./Oracle.sol";
import {BountyFund} from "./BountyFund.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

library VerificationPhaseLib {
    using SafeMath for uint256;

    enum State {Unopened, Opened, Closed}
    enum Status {Null, True, False}

    struct VerificationPhase {
        State state;
        Status result;

        mapping(bool => uint256) statusAmountMap;

        mapping(address => bool) walletStakedMap;
        uint256 stakingWallets;

        mapping(address => mapping(bool => uint256)) walletStatusAmountMap;
        mapping(uint256 => mapping(bool => uint256)) blockStatusAmountMap;

        uint256 bountyAmount;
        bool bountyAwarded;

        uint256 startBlock;
        uint256 endBlock;
    }

    function open(VerificationPhase storage _phase, uint256 _bountyAmount) internal {
        _phase.state = State.Opened;
        _phase.bountyAmount = _bountyAmount;
        _phase.startBlock = block.number;
    }

    function close(VerificationPhase storage _phase) internal {
        _phase.state = State.Closed;
        _phase.endBlock = block.number;
        if (_phase.statusAmountMap[true] > _phase.statusAmountMap[false])
            _phase.result = Status.True;
        else if (_phase.statusAmountMap[true] < _phase.statusAmountMap[false])
            _phase.result = Status.False;
    }

    function updateMetrics(VerificationPhase storage _phase, address _wallet,
        bool _status, uint256 _amount) internal {

        _phase.statusAmountMap[_status] = _phase.statusAmountMap[_status].add(_amount);

        if (!_phase.walletStakedMap[_wallet]) {
            _phase.walletStakedMap[_wallet] = true;
            _phase.stakingWallets++;
        }

        _phase.walletStatusAmountMap[_wallet][_status] = _phase.walletStatusAmountMap[_wallet][_status].add(_amount);
        _phase.blockStatusAmountMap[block.number][_status] = _phase.blockStatusAmountMap[block.number][_status].add(_amount);
    }
}

/// @title ResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine base contract
contract ResolutionEngine is Resolvable, RBACed {
    using SafeMath for uint256;
    using VerificationPhaseLib for VerificationPhaseLib.VerificationPhase;

    event MetricsUpdated(address indexed _wallet, uint256 indexed _verificationPhaseNumber, bool _status,
        uint256 _amount);
    event ConditionallyResolved(uint256 indexed _verificationPhaseNumber);
    event BountyExtracted(uint256 indexed _verificationPhaseNumber, uint256 _bountyFraction,
        uint256 _bountyAmount);
    event VerificationPhaseOpened(uint256 indexed _verificationPhaseNumber);
    event VerificationPhaseClosed(uint256 indexed _verificationPhaseNumber);
    event PayoutWithdrawn(address indexed _wallet, uint256 indexed _verificationPhaseNumber, uint256 _payout);

    string constant public ORACLE_ROLE = "ORACLE";

    Oracle public oracle;
    ERC20 public token;
    BountyFund public bountyFund;
    uint256 public bountyFraction;
    uint256 public bountyAmount;

    uint256 public verificationPhaseNumber;
    mapping(uint256 => VerificationPhaseLib.VerificationPhase) internal verificationPhaseMap;
    mapping(address => mapping(bool => uint256)) private walletStatusAmountMap;
    mapping(uint256 => mapping(bool => uint256)) private blockStatusAmountMap;

    VerificationPhaseLib.Status public verificationStatus;

    mapping(address => mapping(uint256 => bool)) public walletPhasePayoutMap;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _oracle, address _bountyFund, uint256 _bountyFraction) public {
        // Initialize oracle
        oracle = Oracle(_oracle);
        addRoleInternal(ORACLE_ROLE);
        addRoleAccessorInternal(ORACLE_ROLE, _oracle);

        // Initialize bounty fund
        bountyFund = BountyFund(_bountyFund);
        bountyFund.setResolutionEngine(this);

        // Initialize token to the one of bounty fund
        token = ERC20(bountyFund.token());

        // Initialize bounty fraction
        bountyFraction = _bountyFraction;

        // Withdraw bounty
        extractBounty();

        // Open verification phase
        openVerificationPhase();
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

    /// @notice Update metrics following a stake operation in the oracle
    /// @dev The function can only be called by oracle.
    /// @param _wallet The concerned wallet
    /// @param _verificationPhaseNumber The verification phase number whose metrics will be updated, which can only be
    /// the current verification phase number
    /// @param _status The status staked at
    /// @param _amount The amount staked
    function updateMetrics(address _wallet, uint256 _verificationPhaseNumber, bool _status, uint256 _amount)
    public
    onlyRoleAccessor(ORACLE_ROLE)
    onlyCurrentPhaseNumber(_verificationPhaseNumber)
    {
        // Update metrics
        walletStatusAmountMap[_wallet][_status] = walletStatusAmountMap[_wallet][_status].add(_amount);
        blockStatusAmountMap[block.number][_status] = blockStatusAmountMap[block.number][_status].add(_amount);
        verificationPhaseMap[verificationPhaseNumber].updateMetrics(_wallet, _status, _amount);

        // Emit event
        emit MetricsUpdated(_wallet, _verificationPhaseNumber, _status, _amount);
    }

    /// @notice Resolve the market if resolution criteria have been met
    /// @dev The function can only be called by oracle.
    function resolveConditionally() public onlyRoleAccessor(ORACLE_ROLE)
    {
        if (resolutionCriteriaMet()) {
            closeVerificationPhase();
            openVerificationPhase();
        }

        // Emit event
        emit ConditionallyResolved(verificationPhaseNumber);
    }

    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false
    function resolutionCriteriaMet() public view returns (bool) {
        return false;
    }

    /// @notice Get the metrics for the given verification phase number
    /// @dev Reverts if provided verification phase number is higher than current verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    function metricsByVerificationPhaseNumber(uint256 _verificationPhaseNumber)
    public
    view
    onlyCurrentOrEarlierPhaseNumber(_verificationPhaseNumber)
    returns (VerificationPhaseLib.State state, uint256 trueStakeAmount, uint256 falseStakeAmount,
        uint256 stakeAmount, uint256 numberOfWallets, uint256 bountyAmount, bool bountyAwarded,
        uint256 startBlock, uint256 endBlock, uint256 numberOfBlocks)
    {
        state = verificationPhaseMap[_verificationPhaseNumber].state;
        trueStakeAmount = verificationPhaseMap[_verificationPhaseNumber].statusAmountMap[true];
        falseStakeAmount = verificationPhaseMap[_verificationPhaseNumber].statusAmountMap[false];
        stakeAmount = trueStakeAmount.add(falseStakeAmount);
        numberOfWallets = verificationPhaseMap[_verificationPhaseNumber].stakingWallets;
        bountyAmount = verificationPhaseMap[_verificationPhaseNumber].bountyAmount;
        bountyAwarded = verificationPhaseMap[_verificationPhaseNumber].bountyAwarded;
        startBlock = verificationPhaseMap[_verificationPhaseNumber].startBlock;
        endBlock = verificationPhaseMap[_verificationPhaseNumber].endBlock;
        numberOfBlocks = (endBlock == 0 ? block.number : endBlock) - startBlock;
    }

    /// @notice Get the metrics for the given verification phase number and wallet
    /// @dev Reverts if provided verification phase number is higher than current verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @param _wallet The address of the concerned wallet
    function metricsByVerificationPhaseNumberAndWallet(uint256 _verificationPhaseNumber, address _wallet)
    public
    view
    onlyCurrentOrEarlierPhaseNumber(_verificationPhaseNumber)
    returns (uint256 trueStakeAmount, uint256 falseStakeAmount, uint256 stakeAmount)
    {
        trueStakeAmount = verificationPhaseMap[_verificationPhaseNumber].walletStatusAmountMap[_wallet][true];
        falseStakeAmount = verificationPhaseMap[_verificationPhaseNumber].walletStatusAmountMap[_wallet][false];
        stakeAmount = trueStakeAmount.add(falseStakeAmount);
    }

    /// @notice Get the metrics for the wallet
    /// @param _wallet The address of the concerned wallet
    function metricsByWallet(address _wallet)
    public
    view
    returns (uint256 trueStakeAmount, uint256 falseStakeAmount, uint256 stakeAmount)
    {
        trueStakeAmount = walletStatusAmountMap[_wallet][true];
        falseStakeAmount = walletStatusAmountMap[_wallet][false];
        stakeAmount = trueStakeAmount.add(falseStakeAmount);
    }

    /// @notice Get the metrics for the block
    /// @dev Reverts if provided block number is higher than current block number
    /// @param _blockNumber The concerned block number
    function metricsByBlockNumber(uint256 _blockNumber)
    public
    view
    onlyCurrentOrEarlierBlockNumber(_blockNumber)
    returns (uint256 trueStakeAmount, uint256 falseStakeAmount, uint256 stakeAmount)
    {
        trueStakeAmount = blockStatusAmountMap[_blockNumber][true];
        falseStakeAmount = blockStatusAmountMap[_blockNumber][false];
        stakeAmount = trueStakeAmount.add(falseStakeAmount);
    }

    /// @notice Calculate the payout of the given wallet at the given verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @param _wallet The address of the concerned wallet
    function calculatePayout(uint256 _verificationPhaseNumber, address _wallet)
    public
    view
    returns (uint256)
    {
        // Return 0 if no non-null verification status has been obtained
        if (VerificationPhaseLib.Status.Null == verificationPhaseMap[_verificationPhaseNumber].result)
            return 0;

        // Get the status obtained by the verification phase
        bool status = verificationPhaseMap[_verificationPhaseNumber].result == VerificationPhaseLib.Status.True;

        // Get the lot staked opposite of status
        uint256 lot = verificationPhaseMap[_verificationPhaseNumber].statusAmountMap[!status];

        // If bounty was awarded add bounty to the total lot
        if (verificationPhaseMap[_verificationPhaseNumber].bountyAwarded)
            lot = lot.add(verificationPhaseMap[_verificationPhaseNumber].bountyAmount);

        // Return the lot scaled by the fractional contribution that wallet staked on obtained status
        uint256 walletStatusAmount = verificationPhaseMap[_verificationPhaseNumber].walletStatusAmountMap[_wallet][status];
        uint256 statusAmount = verificationPhaseMap[_verificationPhaseNumber].statusAmountMap[status];
        return lot.mul(walletStatusAmount).div(statusAmount);
    }

    /// @notice Withdraw the payout earned by given wallet in the inclusive range of given verification phase numbers
    /// @dev The function can only be called by oracle.
    /// @param _wallet The address of the concerned wallet
    /// @param _firstVerificationPhaseNumber The first verification phase number to withdraw payout from
    /// @param _lastVerificationPhaseNumber The last verification phase number to withdraw payout from
    function withdrawPayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    onlyRoleAccessor(ORACLE_ROLE)
    {
        // For each verification phase number in the inclusive range withdraw payout
        for (uint256 i = _firstVerificationPhaseNumber; i <= _lastVerificationPhaseNumber; i++)
            withdrawPayout(_wallet, i);
    }

    /// @notice Extract from bounty fund
    function extractBounty() internal {
        // Withdraw from bounty fund
        bountyAmount = bountyFund.withdrawTokens(bountyFraction);

        // Emit event
        emit BountyExtracted(verificationPhaseNumber, bountyFraction, bountyAmount);
    }

    /// @notice Open verification phase
    function openVerificationPhase() internal {
        // Require that verification phase is not open
        require(verificationPhaseMap[verificationPhaseNumber].state == VerificationPhaseLib.State.Unopened);

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

        // If new verification status...
        if (verificationPhaseMap[verificationPhaseNumber].result != verificationStatus) {
            // Update verification status of this resolution engine
            verificationStatus = verificationPhaseMap[verificationPhaseNumber].result;

            // Award bounty to this verification phase
            verificationPhaseMap[verificationPhaseNumber].bountyAwarded = true;

            // Extract new bounty
            extractBounty();
        }

        // Emit event
        emit VerificationPhaseClosed(verificationPhaseNumber);

        // Bump verification phase number
        verificationPhaseNumber++;
    }

    /// @notice Withdraw payout of given wallet and verification phase number
    /// @param _wallet The address of the concerned wallet
    /// @param _verificationPhaseNumber The concerned verification phase number
    function withdrawPayout(address _wallet, uint256 _verificationPhaseNumber) internal {
        // Return if the verification phase has not been closed
        if (VerificationPhaseLib.State.Closed != verificationPhaseMap[_verificationPhaseNumber].state)
            return;

        // Return if the wallet has been payed out for this verification phase number already
        if (walletPhasePayoutMap[_wallet][_verificationPhaseNumber])
            return;

        // Calculate payout
        uint256 payout = calculatePayout(_verificationPhaseNumber, _wallet);

        // Register payout of wallet and verification phase number
        walletPhasePayoutMap[_wallet][_verificationPhaseNumber] = true;

        // Transfer payout
        token.transfer(_wallet, payout);

        // Emit event
        emit PayoutWithdrawn(_wallet, _verificationPhaseNumber, payout);
    }
}
