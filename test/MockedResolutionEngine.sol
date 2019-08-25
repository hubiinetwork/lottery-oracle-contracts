/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {VerificationPhaseLib, ResolutionEngine} from "../contracts/ResolutionEngine.sol";
import {BountyFund} from "../contracts/BountyFund.sol";

/// @title MockedResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of resolution engine
contract MockedResolutionEngine is ResolutionEngine {

    constructor(address _oracle, address _bountyFund, uint256 _bountyFraction)
    public
    ResolutionEngine(_oracle, _bountyFund, _bountyFraction)
    {
    }

    function _withdrawTokens(uint256 _bountyFraction) public {
        bountyFund.withdrawTokens(_bountyFraction);
    }

    function _extractBounty() public {
        extractBounty();
    }

    function _openVerificationPhase() public {
        openVerificationPhase();
    }

    function _closeVerificationPhase() public {
        closeVerificationPhase();
    }

    function _setVerificationStatus(VerificationPhaseLib.Status _status) public {
        verificationStatus = _status;
    }

    function _withdrawPayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    {
        for (uint256 i = _firstVerificationPhaseNumber; i <= _lastVerificationPhaseNumber; i++)
            withdrawPayout(_wallet, i);
    }
}
