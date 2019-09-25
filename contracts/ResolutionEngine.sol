/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Resolvable} from "./Resolvable.sol";
import {RBACed} from "./RBACed.sol";
import {Able} from "./Able.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {VerificationPhaseLib} from "./VerificationPhaseLib.sol";
import {BountyFund} from "./BountyFund.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/// @title ResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine base contract
contract ResolutionEngine is Resolvable, RBACed, Able {
    using SafeMath for uint256;
    using VerificationPhaseLib for VerificationPhaseLib.VerificationPhase;

    event Frozen();
    event BountyAllocatorSet(address indexed _bountyAllocator);
    event Staked(address indexed _wallet, uint256 indexed _verificationPhaseNumber, bool _status,
        uint256 _amount);
    event BountyWithdrawn(address indexed _wallet, uint256 _bountyAmount);
    event VerificationPhaseOpened(uint256 indexed _verificationPhaseNumber, uint256 _bountyAmount);
    event VerificationPhaseClosed(uint256 indexed _verificationPhaseNumber);
    event PayoutStaged(address indexed _wallet, uint256 indexed _firstVerificationPhaseNumber,
        uint256 indexed _lastVerificationPhaseNumber, uint256 _payout);
    event StakeStaged(address indexed _wallet, uint _amount);
    event Staged(address indexed _wallet, uint _amount);
    event Withdrawn(address indexed _wallet, uint _amount);

    string constant public STAKE_ACTION = "STAKE";
    string constant public RESOLVE_ACTION = "RESOLVE";

    address public oracle;
    address public operator;
    address public bountyAllocator;

    BountyFund public bountyFund;

    ERC20 public token;

    bool public frozen;

    uint256 public verificationPhaseNumber;

    mapping(uint256 => VerificationPhaseLib.VerificationPhase) public verificationPhaseByPhaseNumber;

    mapping(address => mapping(bool => uint256)) public stakedAmountByWalletStatus;
    mapping(uint256 => mapping(bool => uint256)) public stakedAmountByBlockStatus;

    VerificationPhaseLib.Status public verificationStatus;

    mapping(address => mapping(uint256 => bool)) public payoutStagedByWalletPhase;
    mapping(address => uint256) public stagedAmountByWallet;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _oracle, address _operator, address _bountyFund)
    public
    {
        // Initialize oracle and operator
        oracle = _oracle;
        operator = _operator;

        // Initialize bounty fund
        bountyFund = BountyFund(_bountyFund);
        bountyFund.setResolutionEngine(address(this));

        // Initialize token to the one of bounty fund
        token = ERC20(bountyFund.token());
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "ResolutionEngine: sender is not the defined oracle");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "ResolutionEngine: sender is not the defined operator");
        _;
    }

    modifier onlyNotFrozen() {
        require(!frozen, "ResolutionEngine: is frozen");
        _;
    }

    /// @notice Freeze updates to this resolution engine
    /// @dev This operation can not be undone
    function freeze()
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Set the frozen flag
        frozen = true;

        // Emit event
        emit Frozen();
    }

    /// @notice Set the bounty allocator
    /// @param _bountyAllocator The bounty allocator to be set
    function setBountyAllocator(address _bountyAllocator)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Set the bounty allocator
        bountyAllocator = _bountyAllocator;

        // Emit event
        emit BountyAllocatorSet(bountyAllocator);
    }

    /// @notice Initialize the engine
    function initialize()
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Require no previous initialization
        require(0 == verificationPhaseNumber, "ResolutionEngine: already initialized");

        // Open verification phase
        _openVerificationPhase();
    }

    /// @notice Disable the given action
    /// @param _action The action to disable
    function disable(string memory _action)
    public
    onlyOperator
    {
        // Disable
        super.disable(_action);
    }

    /// @notice Enable the given action
    /// @param _action The action to enable
    function enable(string memory _action)
    public
    onlyOperator
    {
        // Enable
        super.enable(_action);
    }

    /// @notice Stake by updating metrics
    /// @dev The function can only be called by oracle.
    /// @param _wallet The concerned wallet
    /// @param _status The status staked at
    /// @param _amount The amount staked
    function stake(address _wallet, bool _status, uint256 _amount)
    public
    onlyOracle
    onlyEnabled(STAKE_ACTION)
    {
        // Update metrics
        stakedAmountByWalletStatus[_wallet][_status] = stakedAmountByWalletStatus[_wallet][_status].add(_amount);
        stakedAmountByBlockStatus[block.number][_status] = stakedAmountByBlockStatus[block.number][_status]
        .add(_amount);
        verificationPhaseByPhaseNumber[verificationPhaseNumber].stake(_wallet, _status, _amount);

        // Emit event
        emit Staked(_wallet, verificationPhaseNumber, _status, _amount);
    }

    /// @notice Resolve the market in the current verification phase if resolution criteria have been met
    /// @dev The function can only be called by oracle.
    /// be the current verification phase number
    function resolveIfCriteriaMet()
    public
    onlyOracle
    onlyEnabled(RESOLVE_ACTION)
    {
        // If resolution criteria are met...
        if (resolutionCriteriaMet()) {
            // Close existing verification phase
            _closeVerificationPhase();

            // Open new verification phase
            _openVerificationPhase();
        }
    }

    /// @notice Get the metrics for the given verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @return the metrics
    function metricsByVerificationPhaseNumber(uint256 _verificationPhaseNumber)
    public
    view
    returns (VerificationPhaseLib.State state, uint256 trueStakeAmount, uint256 falseStakeAmount,
        uint256 stakeAmount, uint256 numberOfWallets, uint256 bountyAmount, bool bountyAwarded,
        uint256 startBlock, uint256 endBlock, uint256 numberOfBlocks)
    {
        state = verificationPhaseByPhaseNumber[_verificationPhaseNumber].state;
        trueStakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].stakedAmountByStatus[true];
        falseStakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].stakedAmountByStatus[false];
        stakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].stakedAmount;
        numberOfWallets = verificationPhaseByPhaseNumber[_verificationPhaseNumber].stakingWallets;
        bountyAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].bountyAmount;
        bountyAwarded = verificationPhaseByPhaseNumber[_verificationPhaseNumber].bountyAwarded;
        startBlock = verificationPhaseByPhaseNumber[_verificationPhaseNumber].startBlock;
        endBlock = verificationPhaseByPhaseNumber[_verificationPhaseNumber].endBlock;
        numberOfBlocks = (startBlock > 0 && endBlock == 0 ? block.number : endBlock).sub(startBlock);
    }

    /// @notice Get the metrics for the given verification phase number and wallet
    /// @dev Reverts if provided verification phase number is higher than current verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @param _wallet The address of the concerned wallet
    /// @return the metrics
    function metricsByVerificationPhaseNumberAndWallet(uint256 _verificationPhaseNumber, address _wallet)
    public
    view
    returns (uint256 trueStakeAmount, uint256 falseStakeAmount, uint256 stakeAmount)
    {
        trueStakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber]
        .stakedAmountByWalletStatus[_wallet][true];
        falseStakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber]
        .stakedAmountByWalletStatus[_wallet][false];
        stakeAmount = trueStakeAmount.add(falseStakeAmount);
    }

    /// @notice Get the metrics for the wallet
    /// @param _wallet The address of the concerned wallet
    /// @return the metrics
    function metricsByWallet(address _wallet)
    public
    view
    returns (uint256 trueStakeAmount, uint256 falseStakeAmount, uint256 stakeAmount)
    {
        trueStakeAmount = stakedAmountByWalletStatus[_wallet][true];
        falseStakeAmount = stakedAmountByWalletStatus[_wallet][false];
        stakeAmount = trueStakeAmount.add(falseStakeAmount);
    }

    /// @notice Get the metrics for the block
    /// @dev Reverts if provided block number is higher than current block number
    /// @param _blockNumber The concerned block number
    /// @return the metrics
    function metricsByBlockNumber(uint256 _blockNumber)
    public
    view
    returns (uint256 trueStakeAmount, uint256 falseStakeAmount, uint256 stakeAmount)
    {
        trueStakeAmount = stakedAmountByBlockStatus[_blockNumber][true];
        falseStakeAmount = stakedAmountByBlockStatus[_blockNumber][false];
        stakeAmount = trueStakeAmount.add(falseStakeAmount);
    }

    /// @notice Calculate the payout accrued by given wallet in the inclusive range of given verification phase numbers
    /// @param _firstVerificationPhaseNumber The first verification phase number to stage payout from
    /// @param _lastVerificationPhaseNumber The last verification phase number to stage payout from
    /// @param _wallet The address of the concerned wallet
    /// @return the payout
    function calculatePayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    view
    returns (uint256)
    {
        // For each verification phase number in the inclusive range calculate payout
        uint256 payout = 0;
        for (uint256 i = _firstVerificationPhaseNumber; i <= _lastVerificationPhaseNumber; i++)
            payout = payout.add(_calculatePayout(_wallet, i));

        // Return payout
        return payout;
    }

    /// @notice Stage the payout accrued by given wallet in the inclusive range of given verification phase numbers
    /// @dev The function can only be called by oracle.
    /// @param _wallet The address of the concerned wallet
    /// @param _firstVerificationPhaseNumber The first verification phase number to stage payout from
    /// @param _lastVerificationPhaseNumber The last verification phase number to stage payout from
    function stagePayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    onlyOracle
    {
        // For each verification phase number in the inclusive range stage payout
        uint256 amount = 0;
        for (uint256 i = _firstVerificationPhaseNumber; i <= _lastVerificationPhaseNumber; i++)
            amount = amount.add(_stagePayout(_wallet, i));

        // Emit event
        emit PayoutStaged(_wallet, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber, amount);
    }

    /// @notice Stage the amount staked in the current verification phase
    /// @dev The function can only be called by oracle and when resolve action has been disabled
    /// @param _wallet The address of the concerned wallet
    function stageStake(address _wallet)
    public
    onlyOracle
    onlyDisabled(RESOLVE_ACTION)
    {
        // Calculate the amount staked by the wallet
        uint256 amount = verificationPhaseByPhaseNumber[verificationPhaseNumber]
        .stakedAmountByWalletStatus[_wallet][true].add(
            verificationPhaseByPhaseNumber[verificationPhaseNumber]
            .stakedAmountByWalletStatus[_wallet][false]
        );

        // Require no previous stage stage
        require(0 < amount, "ResolutionEngine: stake is zero");

        // Reset wallet's stakes
        verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByWalletStatus[_wallet][true] = 0;
        verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByWalletStatus[_wallet][false] = 0;

        // Stage the amount
        _stage(_wallet, amount);

        // Emit event
        emit StakeStaged(_wallet, amount);
    }

    /// @notice Stage the given amount
    /// @dev The function can only be called by oracle.
    /// @param _wallet The address of the concerned wallet
    /// @param _amount The amount to be staged
    function stage(address _wallet, uint256 _amount)
    public
    onlyOracle
    {
        // Stage the amount
        _stage(_wallet, _amount);

        // Emit event
        emit Staged(_wallet, _amount);
    }

    /// @notice Withdraw the given amount
    /// @dev The function can only be called by oracle.
    /// @param _wallet The address of the concerned wallet
    /// @param _amount The amount to be withdrawn
    function withdraw(address _wallet, uint256 _amount)
    public
    onlyOracle
    {
        // Require that the withdrawal amount is smaller than the wallet's staged amount
        require(_amount <= stagedAmountByWallet[_wallet], "ResolutionEngine: amount is greater than staged amount");

        // Unstage the amount
        stagedAmountByWallet[_wallet] = stagedAmountByWallet[_wallet].sub(_amount);

        // Transfer the amount
        token.transfer(_wallet, _amount);

        // Emit event
        emit Withdrawn(_wallet, _amount);
    }

    /// @notice Stage the bounty to the given address
    /// @param _wallet The recipient address of the bounty transfer
    function withdrawBounty(address _wallet)
    public
    onlyOperator
    onlyDisabled(RESOLVE_ACTION)
    {
        // Require no previous bounty withdrawal
        require(0 < verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount,
            "ResolutionEngine: bounty is zero");

        // Store the bounty amount locally
        uint256 amount = verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount;

        // Reset the bounty amount
        verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount = 0;

        // Transfer the amount
        token.transfer(_wallet, amount);

        // Emit event
        emit BountyWithdrawn(_wallet, amount);
    }

    /// @notice Open verification phase
    function _openVerificationPhase()
    internal
    {
        // Require that verification phase is not open
        require(
            verificationPhaseByPhaseNumber[verificationPhaseNumber.add(1)].state == VerificationPhaseLib.State.Unopened,
            "ResolutionEngine: verification phase is not in unopened state"
        );

        // Bump verification phase number
        verificationPhaseNumber = verificationPhaseNumber.add(1);

        // Allocate from bounty fund using the set bounty allocator
        uint256 bountyAmount = bountyFund.allocateTokens(bountyAllocator);

        // Open the verification phase
        verificationPhaseByPhaseNumber[verificationPhaseNumber].open(bountyAmount);

        // Add criteria params
        _addVerificationCriteria();

        // Emit event
        emit VerificationPhaseOpened(verificationPhaseNumber, bountyAmount);
    }

    /// @notice Augment the verification phase with verification criteria params
    function _addVerificationCriteria() internal;

    /// @notice Close verification phase
    function _closeVerificationPhase()
    internal
    {
        // Require that verification phase is open
        require(verificationPhaseByPhaseNumber[verificationPhaseNumber].state == VerificationPhaseLib.State.Opened,
            "ResolutionEngine: verification phase is not in opened state");

        // Close the verification phase
        verificationPhaseByPhaseNumber[verificationPhaseNumber].close();

        // If new verification status...
        if (verificationPhaseByPhaseNumber[verificationPhaseNumber].result != verificationStatus) {
            // Update verification status of this resolution engine
            verificationStatus = verificationPhaseByPhaseNumber[verificationPhaseNumber].result;

            // Award bounty to this verification phase
            verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAwarded = true;
        }

        // Emit event
        emit VerificationPhaseClosed(verificationPhaseNumber);
    }

    /// @notice Calculate payout of given wallet and verification phase number
    function _calculatePayout(address _wallet, uint256 _verificationPhaseNumber)
    internal
    view
    returns (uint256)
    {
        // Return 0 if no non-null verification status has been obtained
        if (VerificationPhaseLib.Status.Null == verificationPhaseByPhaseNumber[_verificationPhaseNumber].result)
            return 0;

        // Get the status obtained by the verification phase
        bool status =
        verificationPhaseByPhaseNumber[_verificationPhaseNumber].result == VerificationPhaseLib.Status.True;

        // Get the lot staked opposite of status
        uint256 lot = verificationPhaseByPhaseNumber[_verificationPhaseNumber].stakedAmountByStatus[!status];

        // If bounty was awarded add bounty to the total lot
        if (verificationPhaseByPhaseNumber[_verificationPhaseNumber].bountyAwarded)
            lot = lot.add(verificationPhaseByPhaseNumber[_verificationPhaseNumber].bountyAmount);

        // Get the amount the wallet staked and total amount staked on the obtained status
        uint256 walletStatusAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber]
        .stakedAmountByWalletStatus[_wallet][status];
        uint256 statusAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber]
        .stakedAmountByStatus[status];

        // Return the lot scaled by the fractional contribution that wallet staked on the obtained status and
        // to this added the wallet's own staked amount
        return lot.mul(walletStatusAmount).div(statusAmount).add(walletStatusAmount);
    }

    /// @notice Stage payout of given wallet and verification phase number
    function _stagePayout(address _wallet, uint256 _verificationPhaseNumber)
    internal
    returns (uint256)
    {
        // Return if the verification phase has not been closed
        if (VerificationPhaseLib.State.Closed != verificationPhaseByPhaseNumber[_verificationPhaseNumber].state)
            return 0;

        // Return wallet payout has already been staged for this verification phase number
        if (payoutStagedByWalletPhase[_wallet][_verificationPhaseNumber])
            return 0;

        // Register payout of wallet and verification phase number
        payoutStagedByWalletPhase[_wallet][_verificationPhaseNumber] = true;

        // Calculate payout
        uint256 payout = _calculatePayout(_wallet, _verificationPhaseNumber);

        // Stage the payout
        _stage(_wallet, payout);

        // Return payout amount
        return payout;
    }

    /// @notice Stage the given amount for the given wallet
    function _stage(address _wallet, uint256 _amount)
    internal
    {
        stagedAmountByWallet[_wallet] = stagedAmountByWallet[_wallet].add(_amount);
    }
}
