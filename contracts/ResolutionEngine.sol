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

    event MetricsUpdated(address indexed _wallet, uint256 indexed _verificationPhaseNumber, bool _status, uint256 _amount);
    event ConditionallyResolved(uint256 indexed _verificationPhaseNumber);
    event BountyWithdrawn(uint256 indexed _verificationPhaseNumber, uint256 _bountyFraction, uint256 _bountyAmount);
    event VerificationPhaseOpened(uint256 indexed _verificationPhaseNumber);
    event VerificationPhaseClosed(uint256 indexed _verificationPhaseNumber);

    string constant public ORACLE_ROLE = "ORACLE";

    Oracle public oracle;
    ERC20 public token;
    BountyFund public bountyFund;
    uint256 public bountyFraction;
    uint256 public bountyAmount;

    uint256 public verificationPhaseNumber;
    mapping(uint256 => VerificationPhaseLib.VerificationPhase) private verificationPhaseMap;
    mapping(address => mapping(bool => uint256)) private walletStatusAmountMap;
    mapping(uint256 => mapping(bool => uint256)) private blockStatusAmountMap;

    VerificationPhaseLib.Status public verificationStatus;

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
        withdrawFromBountyFund();

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

    /// @notice Update metrics following a stake operation in the orcle
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

        bool status = verificationPhaseMap[_verificationPhaseNumber].result == VerificationPhaseLib.Status.True;

        uint256 lot = verificationPhaseMap[_verificationPhaseNumber].statusAmountMap[!status];
        if (verificationPhaseMap[_verificationPhaseNumber].bountyAwarded)
            lot = lot.add(verificationPhaseMap[_verificationPhaseNumber].bountyAmount);

        uint256 walletStatusAmount = verificationPhaseMap[_verificationPhaseNumber].walletStatusAmountMap[_wallet][status];
        uint256 statusAmount = verificationPhaseMap[_verificationPhaseNumber].statusAmountMap[status];

        return lot.mul(walletStatusAmount).div(statusAmount);
    }

    /// @notice Withdraw from bounty fund
    function withdrawFromBountyFund() internal {
        // Withdraw from bounty fund
        bountyAmount = bountyFund.withdrawTokens(bountyFraction);

        // Emit event
        emit BountyWithdrawn(verificationPhaseNumber, bountyFraction, bountyAmount);
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

            // Withdraw new bounty
            withdrawFromBountyFund();
        }

        // Emit event
        emit VerificationPhaseClosed(verificationPhaseNumber);

        // Bump verification phase number
        verificationPhaseNumber++;
    }

    //    function claim(uint256 _lowVerificationPhaseNumber, uint256 _highVerificationPhaseNumber) internal {
    //        for (uint256 i = _lowVerificationPhaseNumber; i <= _highVerificationPhaseNumber; i++)
    //            claimByVerificationPhaseNumberAndWallet(i, msg.sender);
    //    }
    //
    //    function claimByVerificationPhaseNumberAndWallet(uint256 _verificationPhaseNumber, address _wallet) internal {
    //        // TODO Assure that this verification phase has not been payed out already wallet
    //
    //        uint256 payout = calculatePayoutByVerificationPhaseNumberAndWallet(_verificationPhaseNumber, _wallet);
    //
    //        // TODO Execute the payout
    //    }
}
