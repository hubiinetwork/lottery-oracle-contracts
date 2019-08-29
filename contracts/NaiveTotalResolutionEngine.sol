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
contract NaiveTotalResolutionEngine is Resolvable, ResolutionEngine {

    uint256 public criterionAmountStaked;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _oracle, address _bountyFund, uint256 _bountyFraction,
        uint256 _criterionAmountStaked)
    public
    ResolutionEngine(_oracle, _bountyFund, _bountyFraction)
    {
        criterionAmountStaked = _criterionAmountStaked;
    }

    /// @notice Return the amount needed to resolve the market for the given verification phase number and status
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @param _status The concerned status
    /// @return the amount needed to obtain to resolve the market
    function resolutionDeltaAmount(uint256 _verificationPhaseNumber, bool _status)
    public
    view
    returns (uint256)
    {
        if (_verificationPhaseNumber < verificationPhaseNumber)
            return 0;
        else
            return criterionAmountStaked.sub(verificationPhaseByPhaseNumber[verificationPhaseNumber].amountByStatus[_status]);
    }

    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false
    function resolutionCriteriaMet()
    public
    view
    returns (bool)
    {
        return verificationPhaseByPhaseNumber[verificationPhaseNumber].amountByStatus[true] >= criterionAmountStaked ||
        verificationPhaseByPhaseNumber[verificationPhaseNumber].amountByStatus[false] >= criterionAmountStaked;
    }
}
