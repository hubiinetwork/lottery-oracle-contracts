/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {Resolvable} from "./Resolvable.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";

/// @title NaiveTotalResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A naïve total resolution engine
contract NaiveTotalResolutionEngine is Resolvable, ResolutionEngine {

    uint256 public criterionAmountStaked;

    constructor(address _oracle, address _bountyFund, uint256 _bountyFraction,
        uint256 _criterionAmountStaked)
    public
    ResolutionEngine(_oracle, _bountyFund, _bountyFraction)
    {
        criterionAmountStaked = _criterionAmountStaked;
    }

    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false
    function resolutionCriteriaMet() public view returns (bool) {
        return verificationPhaseMap[verificationPhaseNumber].statusAmountMap[true] >= criterionAmountStaked ||
        verificationPhaseMap[verificationPhaseNumber].statusAmountMap[false] >= criterionAmountStaked;
    }
}
