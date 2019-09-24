/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Resolvable} from "../contracts/Resolvable.sol";
import {VerificationPhaseLib} from "../contracts/ResolutionEngine.sol";
import {BountyFund} from "../contracts/BountyFund.sol";

/// @title MockedResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of resolution engine
contract MockedResolutionEngine is Resolvable {

    string constant public STAKE_ACTION = "STAKE";
    string constant public RESOLVE_ACTION = "RESOLVE";

    uint256 public _verificationPhaseNumber;
    uint256 public _resolutionDeltaAmount;
    bool public _resolutionCriteriaMet;

    address public _token;

    struct StageCall {
        address wallet;
        uint256 amount;
    }

    StageCall public _stageCall;

    struct StakeCall {
        address wallet;
        bool status;
        uint256 amount;
    }

    StakeCall public _stakeCall;

    bool public _resolveIfCriteriaMetCalled;

    struct StagePayoutCall {
        address wallet;
        uint256 firstVerificationPhaseNumber;
        uint256 lastVerificationPhaseNumber;
    }

    StagePayoutCall public _stagePayoutCall;

    address public _stageStakeWallet;

    struct WithdrawCall {
        address wallet;
        uint256 amount;
    }

    WithdrawCall public _withdrawCall;

    BountyFund public _bountyFund;

    VerificationPhaseLib.Status public _verificationStatus;

    bool public _disabled;
    string public _disabledAction;
    string public _enabledAction;

    address public _withdrawBountyWallet;

    uint256 public _calculatedPayout;

    uint256 public _stagedAmount;

    function verificationPhaseNumber()
    public
    view
    returns (uint256)
    {
        return _verificationPhaseNumber;
    }

    function _setVerificationPhaseNumber(uint256 number)
    public
    {
        _verificationPhaseNumber = number;
    }

    function token()
    public
    view
    returns (address)
    {
        return _token;
    }

    function _setToken(address tkn)
    public
    {
        _token = tkn;
    }

    function resolutionDeltaAmount(bool)
    public
    view
    returns (uint256)
    {
        return _resolutionDeltaAmount;
    }

    function _setResolutionDeltaAmount(uint256 amount)
    public
    {
        _resolutionDeltaAmount = amount;
    }

    function resolutionCriteriaMet()
    public
    view
    returns (bool)
    {
        return _resolutionCriteriaMet;
    }

    function _setResolutionCriteria(bool met)
    public
    {
        _resolutionCriteriaMet = met;
    }

    function verificationStatus()
    public
    view
    returns (VerificationPhaseLib.Status)
    {
        return _verificationStatus;
    }

    function _setVerificationStatus(VerificationPhaseLib.Status _status)
    public
    {
        _verificationStatus = _status;
    }

    function stage(address _wallet, uint256 _amount)
    public
    {
        _stageCall = StageCall(_wallet, _amount);
    }

    function stake(address _wallet, bool _status, uint256 _amount)
    public
    {
        _stakeCall = StakeCall(_wallet, _status, _amount);
    }

    function resolveIfCriteriaMet()
    public
    {
        _resolveIfCriteriaMetCalled = true;
    }

    function stagePayout(address _wallet, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    {
        _stagePayoutCall = StagePayoutCall(
            _wallet, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber
        );
    }

    function stageStake(address _wallet)
    public
    {
        _stageStakeWallet = _wallet;
    }

    function withdraw(address _wallet, uint256 _amount)
    public
    {
        _withdrawCall = WithdrawCall(_wallet, _amount);
    }

    function disabled(string memory)
    public
    view
    returns (bool)
    {
        return _disabled;
    }

    function _setDisabled(bool _dsbld)
    public
    {
        _disabled = _dsbld;
    }

    function disable(string memory _action)
    public
    {
        _disabledAction = _action;
    }

    function enable(string memory _action)
    public
    {
        _enabledAction = _action;
    }

    function withdrawBounty(address _wallet)
    public
    {
        _withdrawBountyWallet = _wallet;
    }

    function _setCalculatedPayout(uint256 _calcPay)
    public
    {
        _calculatedPayout = _calcPay;
    }

    function calculatePayout(address, uint256, uint256)
    public
    view
    returns (uint256)
    {
        return _calculatedPayout;
    }

    function _setStagedAmount(uint256 _amount)
    public
    {
        _stagedAmount = _amount;
    }

    function stagedAmountByWallet(address)
    public
    view
    returns (uint256)
    {
        return _stagedAmount;
    }
}
