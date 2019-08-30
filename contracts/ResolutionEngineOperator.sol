/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {RBACed} from "./RBACed.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @title ResolutionEngineOperator
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice An operator of resolution engines
contract ResolutionEngineOperator is RBACed {
    using SafeMath for uint256;

    uint256 public minimumTimeout;
    mapping(address => uint256) public disablementTimeoutByResolutionEngine;

    event DisablementTimerStarted(address indexed _resolutionEngine, uint256 _timeout);
    event DisablementTimerStopped(address indexed _resolutionEngine);
    event Disabled(address indexed _resolutionEngine);

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(uint256 _minimumTimeout)
    public
    {
        minimumTimeout = _minimumTimeout;
    }

    /// @notice Start the disablement timer for the given resolution engine
    /// @dev The timeout can only be greater than or equal to the defined minimum timeout
    /// @param _resolutionEngine The address of the concerned resolution engine
    /// @param _timeout The duration of the timer
    function startDisablementTimer(address _resolutionEngine, uint256 _timeout)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Require that the given timeout beyond the minimum
        require(_timeout >= minimumTimeout);

        // Set the timeout
        disablementTimeoutByResolutionEngine[_resolutionEngine] = block.timestamp.add(_timeout);

        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Disable staking in the resolution engine
        resolutionEngine.disable(resolutionEngine.STAKE_ACTION());

        // Emit event
        emit DisablementTimerStarted(
            _resolutionEngine, disablementTimeoutByResolutionEngine[_resolutionEngine]
        );
    }

    /// @notice Stop the disablement timer for the given resolution engine
    /// @param _resolutionEngine The address of the concerned resolution engine
    function stopDisablementTimer(address _resolutionEngine)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Set the timeout
        disablementTimeoutByResolutionEngine[_resolutionEngine] = 0;

        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Enable staking in the resolution engine
        resolutionEngine.enable(resolutionEngine.STAKE_ACTION());

        // Emit event
        emit DisablementTimerStopped(_resolutionEngine);
    }

    /// @notice Gauge whether the disablement timer of the given resolution engine is expired
    /// @param _resolutionEngine The address of the concerned resolution engine
    /// @return true if the resolution engine's disablement timer is expired, else false
    function isDisablementTimerExpired(address _resolutionEngine)
    public
    view
    returns (bool)
    {
        return block.timestamp >= disablementTimeoutByResolutionEngine[_resolutionEngine];
    }

    /// @notice Disable the given resolution engine
    /// @param _resolutionEngine The address of the concerned resolution engine
    function disable(address _resolutionEngine)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Require that the disablement timer has expired
        require(isDisablementTimerExpired(_resolutionEngine));

        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Disable resolution in the resolution engine
        resolutionEngine.disable(resolutionEngine.RESOLVE_ACTION());

        // Emit event
        emit Disabled(_resolutionEngine);
    }
}
