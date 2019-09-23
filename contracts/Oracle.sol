/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {RBACed} from "./RBACed.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {AddressStoreLib} from "./AddressStoreLib.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/// @title Oracle
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A lottery oracle
contract Oracle is RBACed {
    using SafeMath for uint256;
    using AddressStoreLib for AddressStoreLib.Addresses;

    event ResolutionEngineAdded(address indexed _resolutionEngine);
    event ResolutionEngineRemoved(address indexed _resolutionEngine);
    event TokensStaked(address indexed _wallet, address indexed _resolutionEngine,
        bool _status, uint256 _amount);
    event PayoutStaged(address indexed _wallet, address indexed _resolutionEngine,
        uint256 _firstVerificationPhaseNumber, uint256 _lastVerificationPhaseNumber);
    event StakeStaged(address indexed _wallet, address indexed _resolutionEngine);
    event Withdrawn(address indexed _wallet, address indexed _resolutionEngine,
        uint256 _amount);

    AddressStoreLib.Addresses resolutionEngines;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor()
    public
    {
    }

    modifier onlyRegisteredResolutionEngine(address _resolutionEngine) {
        require(hasResolutionEngine(_resolutionEngine), "Oracle: Resolution engine is not registered");
        _;
    }

    /// @notice Gauge whether an address is the one of a registered resolution engine
    /// @param _resolutionEngine The concerned address
    /// @return true if address is the one of a registered resolution engine, else false
    function hasResolutionEngine(address _resolutionEngine)
    public
    view
    returns
    (bool)
    {
        return resolutionEngines.has(_resolutionEngine);
    }

    /// @notice Return the count of registered resolution engines
    /// @return the count of registered resolution engines
    function resolutionEnginesCount()
    public
    view
    returns (uint256)
    {
        return resolutionEngines.list.length;
    }

    /// @notice Register a resolution engine by its address
    /// @param _resolutionEngine The concerned address
    function addResolutionEngine(address _resolutionEngine)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Add resolution engine
        resolutionEngines.add(_resolutionEngine);

        // Emit event
        emit ResolutionEngineAdded(_resolutionEngine);
    }

    /// @notice Deregister a resolution engine by its address
    /// @param _resolutionEngine The concerned address
    function removeResolutionEngine(address _resolutionEngine)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Remove resolution engine
        resolutionEngines.remove(_resolutionEngine);

        // Emit event
        emit ResolutionEngineRemoved(_resolutionEngine);
    }

    /// @notice Stake the amount of tokens for the given resolution engine and verification phase number
    /// at the given status
    /// @dev Client has to do prior approval of the transfer for the given amount
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _verificationPhaseNumber The verification phase number to stake into
    /// @param _amount The amount staked
    /// @param _status The status staked at
    function stake(address _resolutionEngine, uint256 _verificationPhaseNumber, bool _status, uint256 _amount)
    public
    onlyRegisteredResolutionEngine(_resolutionEngine)
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Require that stake targets current verification phase number
        require(resolutionEngine.verificationPhaseNumber() == _verificationPhaseNumber,
            "Oracle: not the current verification phase number");

        // Calculate the stake overage amount
        uint256 resolutionDeltaAmount = resolutionEngine.resolutionDeltaAmount(_status);
        uint256 overageAmount = _amount > resolutionDeltaAmount ?
        _amount.sub(resolutionDeltaAmount) :
        0;

        // Initialize token
        ERC20 token = ERC20(resolutionEngine.token());

        // Transfer from msg.sender to this resolution engine
        token.transferFrom(msg.sender, _resolutionEngine, _amount);

        // Stage for refund the stake overage amount
        if (overageAmount > 0)
            resolutionEngine.stage(msg.sender, overageAmount);

        // Update the current verification phase metrics post transfer
        resolutionEngine.stake(msg.sender, _status, _amount.sub(overageAmount));

        // Possibly resolve market in the current verification phase if resolution criteria have been met
        resolutionEngine.resolveIfCriteriaMet();

        // Emit event
        emit TokensStaked(msg.sender, _resolutionEngine, _status, _amount);
    }

    /// @notice Calculate the payout for the given resolution engine and wallet at the
    /// given verification phase number range
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _wallet The address of the concerned wallet
    /// @param _firstVerificationPhaseNumber The first verification phase number to stage payout from
    /// @param _lastVerificationPhaseNumber The last verification phase number to stage payout from
    /// @return the payout
    function calculatePayout(address _resolutionEngine, address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    view
    returns (uint256)
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Return calculated payout
        return resolutionEngine.calculatePayout(_wallet, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber);
    }

    /// @notice Stage payout for the given resolution engine and inclusive verification phase number range
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _firstVerificationPhaseNumber The first verification phase number to stage payout from
    /// @param _lastVerificationPhaseNumber The last verification phase number to stage payout from
    function stagePayout(address _resolutionEngine, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Withdraw payout from resolution engine
        resolutionEngine.stagePayout(msg.sender, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber);

        // Emit event
        emit PayoutStaged(msg.sender, _resolutionEngine, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber);
    }

    /// @notice Stage the stake for the given resolution engine
    /// @param _resolutionEngine The concerned resolution engine
    function stageStake(address _resolutionEngine)
    public
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Withdraw payout from resolution engine
        resolutionEngine.stageStake(msg.sender);

        // Emit event
        emit StakeStaged(msg.sender, _resolutionEngine);
    }

    /// @notice Return the staged amount for the given resolution engine and wallet
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _wallet The address of the concerned wallet
    /// @return the staged amount
    function stagedAmountByWallet(address _resolutionEngine, address _wallet)
    public
    view
    returns (uint256)
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Return staged amount
        return resolutionEngine.stagedAmountByWallet(_wallet);
    }

    /// @notice Withdraw the given amount for the given resolution engine
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _amount The amount to be withdrawn
    function withdraw(address _resolutionEngine, uint256 _amount)
    public
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Withdraw payout from resolution engine
        resolutionEngine.withdraw(msg.sender, _amount);

        // Emit event
        emit Withdrawn(msg.sender, _resolutionEngine, _amount);
    }
}
