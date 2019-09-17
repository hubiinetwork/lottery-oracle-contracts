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

    uint256 public amount;

    /// @notice `msg.sender` will be added as accessor to the owner role
    /// @param _oracle The address of oracle
    /// @param _operator The address of operator
    /// @param _bountyFund The address of bounty fund
    /// @param _amount The amount criterion of this resolution engine
    constructor(address _oracle, address _operator, address _bountyFund,
        uint256 _amount)
    public
    ResolutionEngine(_oracle, _operator, _bountyFund)
    {
        amount = _amount;
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
        amount > verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[_status] ?
        amount.sub(
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
        return verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[true] >= amount ||
        verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[false] >= amount;
    }
}
