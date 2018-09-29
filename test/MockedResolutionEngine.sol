/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {VerificationPhaseLib, ResolutionEngine} from "../contracts/ResolutionEngine.sol";
import {BountyFund} from "../contracts/BountyFund.sol";

/// @title MockedResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of resolution engine
contract MockedResolutionEngine is ResolutionEngine {

    struct Payout {
        address wallet;
        uint256 firstVerificationPhaseNumber;
        uint256 lastVerificationPhaseNumber;
    }

    Payout[] public payouts;

    constructor(address _oracle, address _bountyFund, uint256 _bountyFraction)
    public
    ResolutionEngine(_oracle, _bountyFund, _bountyFraction)
    {
    }

    function _withdrawTokens(uint256 _fraction) public {
        bountyFund.withdrawTokens(_fraction);
    }

    function _withdrawFromBountyFund() public {
        withdrawFromBountyFund();
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

    function withdrawPayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber) public {
        payouts.push(Payout(_wallet, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber));
    }
}
