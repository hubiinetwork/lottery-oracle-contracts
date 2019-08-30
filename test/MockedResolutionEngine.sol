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
contract MockedResolutionEngine /*is ResolutionEngine*/ {

    uint256 public _resolutionDeltaAmount;
    bool public _resolutionCriteriaMet;

    struct StageCall {
        address wallet;
        uint256 amount;
    }

    StageCall public stageCall;

    struct UpdateStakeMetricsCall {
        address wallet;
        bool status;
        uint256 amount;
    }

    UpdateStakeMetricsCall public updateStakeMetricsCall;

    bool public resolveIfCriteriaMetCalled;

    struct StagePayoutCall {
        address wallet;
        uint256 firstVerificationPhaseNumber;
        uint256 lastVerificationPhaseNumber;
    }

    StagePayoutCall public stagePayoutCall;

    struct WithdrawCall {
        address wallet;
        uint256 amount;
    }

    WithdrawCall public withdrawCall;

    BountyFund public bountyFund;

    VerificationPhaseLib.Status public verificationStatus;


    constructor(address _oracle, address _bountyFund, uint256 _bountyFraction)
    public
        //    ResolutionEngine(_oracle, _bountyFund, _bountyFraction)
    {

    }

    function resolutionDeltaAmount(uint256, bool) public view returns (uint256) {
        return _resolutionDeltaAmount;
    }

    function _setResolutionDeltaAmount(uint256 amount) public {
        _resolutionDeltaAmount = amount;
    }

    function resolutionCriteriaMet() public view returns (bool) {
        return _resolutionCriteriaMet;
    }

    function _setResolutionCriteria(bool met) public {
        _resolutionCriteriaMet = met;
    }

    function _withdrawTokens(uint256 _bountyFraction) public {
        bountyFund.withdrawTokens(_bountyFraction);
    }

    function _setVerificationStatus(VerificationPhaseLib.Status _status) public {
        verificationStatus = _status;
    }

    function _stagePayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    {
        //        for (uint256 i = _firstVerificationPhaseNumber; i <= _lastVerificationPhaseNumber; i++)
        //            super._stagePayout(_wallet, i);
    }

    function stage(address _wallet, uint256 _amount)
    public
    {
        stageCall = StageCall(_wallet, _amount);
    }

    function updateStakeMetrics(address _wallet, bool _status, uint256 _amount)
    public
    {
        updateStakeMetricsCall = UpdateStakeMetricsCall(_wallet, _status, _amount);
    }

    function resolveIfCriteriaMet()
    public
    {
        resolveIfCriteriaMetCalled = true;
    }

    function stagePayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    {
        stagePayoutCall = StagePayoutCall(_wallet, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber);
    }

    function withdraw(address _wallet, uint256 _amount)
    public
    {
        withdrawCall = WithdrawCall(_wallet, _amount);
    }
}
