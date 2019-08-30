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
    mapping(address => uint256) public teardownTimeoutByResolutionEngine;

    event TeardownTimerStarted(address indexed _resolutionEngine, uint256 _timeout);
    event TornDown(address indexed _resolutionEngine);

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(uint256 _minimumTimeout)
    public
    {
        minimumTimeout = _minimumTimeout;
    }

    modifier onlyGreaterOrEqual(uint256 a, uint256 b) {
        require(a >= b);
        _;
    }

    /// @notice Start the teardown timer for the given resolution engine
    /// @dev The timeout can only be greater than or equal to the defined minimum timeout
    /// @param _resolutionEngine The address of the concerned resolution engine
    /// @param _timeout The duration of the timer
    function startTeardownTimer(address _resolutionEngine, uint256 _timeout)
    public
    onlyRoleAccessor(OWNER_ROLE)
    onlyGreaterOrEqual(_timeout, minimumTimeout)
    {
        // Set the timeout
        teardownTimeoutByResolutionEngine[_resolutionEngine] = block.timestamp.add(_timeout);

        // Emit event
        emit TeardownTimerStarted(
            _resolutionEngine, teardownTimeoutByResolutionEngine[_resolutionEngine]
        );
    }

    /// @notice Gauge whether the teardown timer of the given resolution engine is expired
    /// @param _resolutionEngine The address of the concerned resolution engine
    /// @return true if the resolution engine's teardown timer is expired, else false
    function isTeardownTimerExpired(address _resolutionEngine)
    public
    view
    returns (bool)
    {
        return block.timestamp >= teardownTimeoutByResolutionEngine[_resolutionEngine];
    }

    /// @notice Tear down the given resolution engine
    /// @param _resolutionEngine The address of the concerned resolution engine
    function tearDown(address _resolutionEngine)
    public
    onlyGreaterOrEqual(block.timestamp, teardownTimeoutByResolutionEngine[_resolutionEngine])
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Disable the resolution engine
        resolutionEngine.disable();

        // Emit event
        emit TornDown(_resolutionEngine);
    }
}
