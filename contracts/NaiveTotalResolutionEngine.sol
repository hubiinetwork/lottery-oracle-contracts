/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Resolvable} from "./Resolvable.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";

/// @title NaiveTotalResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A naïve total resolution engine
/// Resolve the staking market when:
/// - The total number of tokens staked on either option reaches the defined amount criterion
contract NaiveTotalResolutionEngine is Resolvable, ResolutionEngine {

    event NextAmountSet(uint256 amount);

    uint256 public nextAmount;

    /// @notice `msg.sender` will be added as accessor to the owner role
    /// @param _oracle The address of oracle
    /// @param _operator The address of operator
    /// @param _bountyFund The address of bounty fund
    /// @param _nextAmount The next amount criterion of this resolution engine
    constructor(address _oracle, address _operator, address _bountyFund,
        uint256 _nextAmount)
    public
    ResolutionEngine(_oracle, _operator, _bountyFund)
    {
        nextAmount = _nextAmount;
    }

    /// @notice Return the amount needed to resolve the current market for the given status
    /// @param _status The concerned status
    /// @return the amount needed to obtain to resolve the market
    function resolutionDeltaAmount(bool _status)
    public
    view
    returns (uint256)
    {
        return (
        amountByPhaseNumber(verificationPhaseNumber) >
        verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[_status] ?
        amountByPhaseNumber(verificationPhaseNumber).sub(
            verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[_status]
        ) :
        0
        );
    }

    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false
    function resolutionCriteriaMet()
    public
    view
    returns (bool)
    {
        return verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[true] >=
        amountByPhaseNumber(verificationPhaseNumber) ||
        verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[false] >=
        amountByPhaseNumber(verificationPhaseNumber);
    }


    /// @notice Set the next amount criterion
    /// @dev Only enabled when the resolution engine is not frozen
    /// @param _nextAmount The next amount
    function setNextAmount(uint256 _nextAmount)
    public
    onlyRoleAccessor(OWNER_ROLE)
    onlyNotFrozen
    {
        // Set the amount
        nextAmount = _nextAmount;

        // Emit event
        emit NextAmountSet(nextAmount);
    }

    /// @notice Get the amount parameter by the given verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @return the amount value
    function amountByPhaseNumber(uint256 _verificationPhaseNumber)
    public
    view
    returns (uint256)
    {
        return verificationPhaseByPhaseNumber[_verificationPhaseNumber].uintCriteria[0];
    }

    /// @notice Augment the verification phase with verification criteria params
    function _addVerificationCriteria()
    internal
    {
        verificationPhaseByPhaseNumber[verificationPhaseNumber].uintCriteria.push(nextAmount);
    }
}
