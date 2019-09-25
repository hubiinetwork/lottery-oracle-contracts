/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {RBACed} from "./RBACed.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";
import {BountyFund} from "./BountyFund.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @title Operator
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice An operator of resolution engines and bounty funds
contract Operator is RBACed {
    using SafeMath for uint256;

    bool public frozen;

    uint256 public minimumTimeout;
    mapping(address => uint256) public disablementTimeoutByResolutionEngine;

    event Frozen();
    event DisablementTimerStarted(address indexed _resolutionEngine, uint256 _timeout);
    event DisablementTimerStopped(address indexed _resolutionEngine);
    event Disabled(address indexed _resolutionEngine);
    event AllocatedBountyWithdrawn(address indexed _resolutionEngine);
    event UnallocatedBountyWithdrawn(address indexed _bountyFund);
    event MinimumTimeoutSet(uint256 minimumTimeout);

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(uint256 _minimumTimeout)
    public
    {
        minimumTimeout = _minimumTimeout;
    }

    modifier onlyNotFrozen() {
        require(!frozen, "Operator: is frozen");
        _;
    }

    /// @notice Freeze updates to this operator
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

    /// @notice Start the disablement timer for the given resolution engine
    /// @dev The timeout can only be greater than or equal to the defined minimum timeout
    /// @param _resolutionEngine The address of the concerned resolution engine
    /// @param _timeout The duration of the timer
    function startDisablementTimer(address _resolutionEngine, uint256 _timeout)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Require that the given timeout beyond the minimum
        require(_timeout >= minimumTimeout, "Operator: timeout is smaller than the set minimum");

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
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Require that the resolution engine's resolve action has not been disabled
        require(!resolutionEngine.disabled(resolutionEngine.RESOLVE_ACTION()),
            "Operator: resolution engine has already been disabled");

        // Set the timeout
        disablementTimeoutByResolutionEngine[_resolutionEngine] = 0;

        // Enable staking in the resolution engine
        resolutionEngine.enable(resolutionEngine.STAKE_ACTION());

        // Emit event
        emit DisablementTimerStopped(_resolutionEngine);
    }

    /// @notice Gauge whether the disablement timer for the given resolution engine is expired
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
        require(
            isDisablementTimerExpired(_resolutionEngine),
            "Operator: disablement timer is not expired"
        );

        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Disable resolution in the resolution engine
        resolutionEngine.disable(resolutionEngine.RESOLVE_ACTION());

        // Emit event
        emit Disabled(_resolutionEngine);
    }

    /// @notice Withdraw allocated bounty for the given resolution engine
    /// @param _resolutionEngine The address of the concerned resolution engine
    /// @param _wallet The recipient address of the bounty transfer
    function withdrawAllocatedBounty(address _resolutionEngine, address _wallet)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Withdraw the allocated bounty
        resolutionEngine.withdrawBounty(_wallet);

        // Emit event
        emit AllocatedBountyWithdrawn(_resolutionEngine);
    }

    /// @notice Withdraw unallocated bounty for the given bounty fund
    /// @param _bountyFund The address of the concerned bounty fund
    /// @param _wallet The recipient address of the bounty transfer
    function withdrawUnallocatedBounty(address _bountyFund, address _wallet)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Initialize bounty fund
        BountyFund bountyFund = BountyFund(_bountyFund);

        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(bountyFund.resolutionEngine());

        // Require that the resolution engine's resolve action is disabled
        require(resolutionEngine.disabled(resolutionEngine.RESOLVE_ACTION()),
            "Operator: resolution engine's resolve action not disabled");

        // Withdraw the unallocated bounty
        bountyFund.withdraw(_wallet);

        // Emit event
        emit UnallocatedBountyWithdrawn(_bountyFund);
    }

    /// @notice Set the minimum timeout criterion
    /// @dev Only enabled when the resolution engine is not frozen
    /// @param _minimumTimeout The concerned minimum timeout
    function setMinimumTimeout(uint256 _minimumTimeout)
    public
    onlyRoleAccessor(OWNER_ROLE)
    onlyNotFrozen
    {
        // Set the minimumTimeout
        minimumTimeout = _minimumTimeout;

        // Emit event
        emit MinimumTimeoutSet(minimumTimeout);
    }
}
