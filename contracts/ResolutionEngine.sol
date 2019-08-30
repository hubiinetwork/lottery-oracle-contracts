/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Resolvable} from "./Resolvable.sol";
import {RBACed} from "./RBACed.sol";
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

        mapping(bool => uint256) amountByStatus;

        mapping(address => bool) stakedByWallet;
        uint256 stakingWallets;

        mapping(address => mapping(bool => uint256)) stakedAmountByWalletStatus;
        mapping(uint256 => mapping(bool => uint256)) stakedAmountByBlockStatus;

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
        if (_phase.amountByStatus[true] > _phase.amountByStatus[false])
            _phase.result = Status.True;
        else if (_phase.amountByStatus[true] < _phase.amountByStatus[false])
            _phase.result = Status.False;
    }

    function stake(VerificationPhase storage _phase, address _wallet,
        bool _status, uint256 _amount) internal {

        _phase.amountByStatus[_status] = _phase.amountByStatus[_status].add(_amount);

        if (!_phase.stakedByWallet[_wallet]) {
            _phase.stakedByWallet[_wallet] = true;
            _phase.stakingWallets++;
        }

        _phase.stakedAmountByWalletStatus[_wallet][_status] = _phase.stakedAmountByWalletStatus[_wallet][_status].add(_amount);
        _phase.stakedAmountByBlockStatus[block.number][_status] = _phase.stakedAmountByBlockStatus[block.number][_status].add(_amount);
    }
}

/// @title ResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine base contract
contract ResolutionEngine is Resolvable, RBACed {
    using SafeMath for uint256;
    using VerificationPhaseLib for VerificationPhaseLib.VerificationPhase;

    event Disabled(string action);
    event Enabled(string action);
    event Staked(address indexed _wallet, uint256 indexed _verificationPhaseNumber, bool _status,
        uint256 _amount);
    event Resolved(uint256 indexed _verificationPhaseNumber);
    event BountyImported(uint256 indexed _verificationPhaseNumber, uint256 _bountyFraction,
        uint256 _bountyAmount);
    event BountyStaged(address indexed _wallet, uint256 _bountyAmount);
    event VerificationPhaseOpened(uint256 indexed _verificationPhaseNumber);
    event VerificationPhaseClosed(uint256 indexed _verificationPhaseNumber);
    event PayoutStaged(address indexed _wallet, uint256 indexed _firstVerificationPhaseNumber,
        uint256 indexed _lastVerificationPhaseNumber, uint256 _payout);
    event Staged(address indexed _wallet, uint _amount);
    event Withdrawn(address indexed _wallet, uint _amount);

    string constant public ORACLE_ROLE = "ORACLE";
    string constant public OPERATOR_ROLE = "OPERATOR";

    string constant public STAKE_ACTION = "STAKE";
    string constant public RESOLVE_ACTION = "RESOLVE";

    bool public disabled;

    address public oracle;
    address public operator;

    BountyFund public bountyFund;
    
    ERC20 public token;
    
    struct Bounty {
        uint256 fraction;
        uint256 amount;
    }

    Bounty public bounty;

    uint256 public verificationPhaseNumber;

    mapping(uint256 => VerificationPhaseLib.VerificationPhase) public verificationPhaseByPhaseNumber;

    mapping(address => mapping(bool => uint256)) public stakedAmountByWalletStatus;

    mapping(uint256 => mapping(bool => uint256)) public stakedAmountByBlockStatus;

    VerificationPhaseLib.Status public verificationStatus;

    mapping(address => mapping(uint256 => bool)) public payoutStagedByWalletPhase;

    mapping(address => uint256) public stagedAmountByWallet;

    mapping(string => bool) public disabledByAction;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _oracle, address _operator, address _bountyFund, uint256 _bountyFraction)
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

        // Initialize bounty fraction
        bounty.fraction = _bountyFraction;

        // Withdraw bounty
        _importBounty();

        // Open verification phase
        _openVerificationPhase();
    }
    
    modifier onlyOracle() {
        require(msg.sender == oracle);
        _;
    }
    
    modifier onlyOperator() {
        require(msg.sender == operator);
        _;
    }

    /// @notice Disable the given action
    /// @param _action The action to disable
    function disable(string memory _action)
    public
    onlyOperator
    {
        // Require that the action is enabled
        require(!disabledByAction[_action]);

        // Disable action
        disabledByAction[_action] = true;

        // Emit event
        emit Disabled(_action);
    }

    /// @notice Enable the given action
    /// @param _action The action to enable
    function enable(string memory _action)
    public
    onlyOperator
    {
        // Require that the action is disabled
        require(disabledByAction[_action]);

        // Enable action
        disabledByAction[_action] = false;

        // Emit event
        emit Enabled(_action);
    }

    /// @notice Stake by updating metrics
    /// @dev The function can only be called by oracle.
    /// @param _wallet The concerned wallet
    /// @param _status The status staked at
    /// @param _amount The amount staked
    function stake(address _wallet, bool _status, uint256 _amount)
    public
    onlyOracle
    {
        // Require that stake action has not been disabled
        require(!disabledByAction[STAKE_ACTION]);

        // Update metrics
        stakedAmountByWalletStatus[_wallet][_status] = stakedAmountByWalletStatus[_wallet][_status].add(_amount);
        stakedAmountByBlockStatus[block.number][_status] = stakedAmountByBlockStatus[block.number][_status].add(_amount);
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
    {
        // Require that resolve action has not been disabled
        require(!disabledByAction[RESOLVE_ACTION]);

        // If resolution criteria are met...
        if (resolutionCriteriaMet()) {
            // Close existing verification phase
            _closeVerificationPhase();

            // Emit event
            emit Resolved(verificationPhaseNumber);

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
        trueStakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].amountByStatus[true];
        falseStakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].amountByStatus[false];
        stakeAmount = trueStakeAmount.add(falseStakeAmount);
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
        trueStakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].stakedAmountByWalletStatus[_wallet][true];
        falseStakeAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].stakedAmountByWalletStatus[_wallet][false];
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

    /// @notice Calculate the payout of the given wallet at the given verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @param _wallet The address of the concerned wallet
    /// @return the payout
    function calculatePayout(uint256 _verificationPhaseNumber, address _wallet)
    public
    view
    returns (uint256)
    {
        // Return 0 if no non-null verification status has been obtained
        if (VerificationPhaseLib.Status.Null == verificationPhaseByPhaseNumber[_verificationPhaseNumber].result)
            return 0;

        // Get the status obtained by the verification phase
        bool status = verificationPhaseByPhaseNumber[_verificationPhaseNumber].result == VerificationPhaseLib.Status.True;

        // Get the lot staked opposite of status
        uint256 lot = verificationPhaseByPhaseNumber[_verificationPhaseNumber].amountByStatus[!status];

        // If bounty was awarded add bounty to the total lot
        if (verificationPhaseByPhaseNumber[_verificationPhaseNumber].bountyAwarded)
            lot = lot.add(verificationPhaseByPhaseNumber[_verificationPhaseNumber].bountyAmount);

        // Get the amount the wallet staked and total amount staked on the obtained status
        uint256 walletStatusAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].stakedAmountByWalletStatus[_wallet][status];
        uint256 statusAmount = verificationPhaseByPhaseNumber[_verificationPhaseNumber].amountByStatus[status];

        // Return the lot scaled by the fractional contribution that wallet staked on the obtained status and
        // to this added the wallet's own staked amount
        return lot.mul(walletStatusAmount).div(statusAmount).add(walletStatusAmount);
    }

    /// @notice Stage the payout earned by given wallet in the inclusive range of given verification phase numbers
    /// @dev The function can only be called by oracle.
    /// @param _wallet The address of the concerned wallet
    /// @param _firstVerificationPhaseNumber The first verification phase number to withdraw payout from
    /// @param _lastVerificationPhaseNumber The last verification phase number to withdraw payout from
    function stagePayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    onlyOracle
    {
        // For each verification phase number in the inclusive range withdraw payout
        uint256 payout = 0;
        for (uint256 i = _firstVerificationPhaseNumber; i <= _lastVerificationPhaseNumber; i++)
            payout = payout.add(_stagePayout(_wallet, i));

        // Emit event
        emit PayoutStaged(_wallet, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber, payout);
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
        // Withdraw the amount
        _withdraw(_wallet, _amount);

        // Emit event
        emit Withdrawn(_wallet, _amount);
    }

    /// @notice Export the bounty to the given address
    /// @param _wallet The recipient address of the bounty transfer
    function stageBounty(address _wallet)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Require that resolve action has not been disabled
        require(disabledByAction[RESOLVE_ACTION]);

        // Increment the wallets staged amount
        stagedAmountByWallet[_wallet] = stagedAmountByWallet[_wallet].add(bounty.amount);

        // Emit event
        emit BountyStaged(_wallet, bounty.amount);
    }

    /// @notice Import from bounty fund
    function _importBounty()
    internal
    {
        // Withdraw from bounty fund
        bounty.amount = bountyFund.withdrawTokens(bounty.fraction);

        // Emit event
        emit BountyImported(verificationPhaseNumber, bounty.fraction, bounty.amount);
    }

    /// @notice Open verification phase
    function _openVerificationPhase()
    internal
    {
        // Require that verification phase is not open
        require(verificationPhaseByPhaseNumber[verificationPhaseNumber.add(1)].state == VerificationPhaseLib.State.Unopened);

        // Bump verification phase number
        verificationPhaseNumber++;

        // Open the verification phase
        verificationPhaseByPhaseNumber[verificationPhaseNumber].open(bounty.amount);

        // Emit event
        emit VerificationPhaseOpened(verificationPhaseNumber);
    }

    /// @notice Close verification phase
    function _closeVerificationPhase()
    internal
    {
        // Require that verification phase is open
        require(verificationPhaseByPhaseNumber[verificationPhaseNumber].state == VerificationPhaseLib.State.Opened);

        // Close the verification phase
        verificationPhaseByPhaseNumber[verificationPhaseNumber].close();

        // If new verification status...
        if (verificationPhaseByPhaseNumber[verificationPhaseNumber].result != verificationStatus) {
            // Update verification status of this resolution engine
            verificationStatus = verificationPhaseByPhaseNumber[verificationPhaseNumber].result;

            // Award bounty to this verification phase
            verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAwarded = true;

            // Extract new bounty
            _importBounty();
        }

        // Emit event
        emit VerificationPhaseClosed(verificationPhaseNumber);
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

        // Calculate payout
        uint256 payout = calculatePayout(_verificationPhaseNumber, _wallet);

        // Register payout of wallet and verification phase number
        payoutStagedByWalletPhase[_wallet][_verificationPhaseNumber] = true;

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

    /// @notice Stage the given amount for the given wallet
    function _withdraw(address _wallet, uint256 _amount)
    internal
    {
        // Require that the withdrawal amount is smaller than the wallet's staged amount
        require(_amount <= stagedAmountByWallet[_wallet]);

        // Unstage the amount
        stagedAmountByWallet[_wallet] = stagedAmountByWallet[_wallet].sub(_amount);

        // Transfer the amount
        token.transfer(_wallet, _amount);
    }
}
