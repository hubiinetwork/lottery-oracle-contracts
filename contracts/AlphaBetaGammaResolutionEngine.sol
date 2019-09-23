/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Resolvable} from "./Resolvable.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";
import {ConstantsLib} from "./ConstantsLib.sol";
import {Math} from "openzeppelin-solidity/contracts/math/Math.sol";

/// @title AlphaBetaGammaResolutionEngine
/// @author Mark Briscombe <mark@hubii.com> & Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine with Bounty with Ratio, Percentage and Addresses
/// Resolve the staking market when:
/// - The total number of tokens staked on the market is >= alpha times the number of tokens posted for the Bounty AND;
/// - The percentage of tokens staked on either option across the market is >= beta % AND;
/// - The total number of addresses staking tokens is >= gamma
contract AlphaBetaGammaResolutionEngine is Resolvable, ResolutionEngine {

    event NextAlphaSet(uint256 alpha);
    event NextBetaSet(uint256 beta);
    event NextGammaSet(uint256 gamma);

    uint256 constant private ALPHA_INDEX = 0;
    uint256 constant private BETA_INDEX = 1;
    uint256 constant private GAMMA_INDEX = 2;

    uint256 public nextAlpha;
    uint256 public nextBeta;
    uint256 public nextGamma;

    /// @notice `msg.sender` will be added as accessor to the owner role
    /// @param _oracle The address of oracle
    /// @param _operator The address of operator
    /// @param _bountyFund The address of bounty fund
    /// @param _nextAlpha The next alpha criterion of this resolution engine
    /// @param _nextBeta The next beta criterion of this resolution engine
    /// @param _nextGamma The next gamma criterion of this resolution engine
    constructor(address _oracle, address _operator, address _bountyFund,
        uint256 _nextAlpha, uint256 _nextBeta, uint256 _nextGamma)
    public
    ResolutionEngine(_oracle, _operator, _bountyFund)
    {
        nextAlpha = _nextAlpha;
        nextBeta = _nextBeta;
        nextGamma = _nextGamma;
    }

    /// @notice Return the amount needed to resolve the current market for the given status
    /// @param _status The concerned status
    /// @return the amount needed to obtain to resolve the market
    function resolutionDeltaAmount(bool _status)
    public
    view
    returns (uint256)
    {
        uint256 alphaAmount = alphaResolutionDeltaAmount();
        uint256 betaAmount = betaResolutionDeltaAmount(_status);
        return Math.max(alphaAmount, betaAmount);
    }

    /// @notice Return the amount needed to resolve the alpha criterion
    /// @return the amount needed to obtain to resolve the alpha criterion
    function alphaResolutionDeltaAmount()
    public
    view
    returns (uint256)
    {
        uint256 scaledBountyAmount = alphaByPhaseNumber(verificationPhaseNumber)
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount);
        return (
        scaledBountyAmount > verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount ?
        scaledBountyAmount.sub(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount) :
        0
        );
    }

    /// @notice Return the amount needed to resolve the beta criterion for the given status
    /// @param _status The concerned status
    /// @return the amount needed to obtain to resolve the beta criterion
    function betaResolutionDeltaAmount(bool _status)
    public
    view
    returns (uint256)
    {
        uint256 scaledStakedAmount = betaByPhaseNumber(verificationPhaseNumber)
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount);
        uint256 scaledStatusStakedAmount = ConstantsLib.PARTS_PER()
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[_status]);
        return (
        scaledStatusStakedAmount < scaledStakedAmount ?
        scaledStakedAmount.sub(scaledStatusStakedAmount).div(
            ConstantsLib.PARTS_PER().sub(betaByPhaseNumber(verificationPhaseNumber))
        ) :
        0
        );
    }

    /// @notice Return the number of staking wallets needed to resolve the gamma criterion
    /// @return the number of staking wallets needed to resolve the gamma criterion
    function gammaResolutionDelta()
    public
    view
    returns (uint256)
    {
        return gammaByPhaseNumber(verificationPhaseNumber)
        .sub(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakingWallets);
    }

    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false
    function resolutionCriteriaMet()
    public
    view
    returns (bool)
    {
        return alphaCriterionMet() && betaCriterionMet() && gammaCriterionMet();
    }

    /// @notice Gauge whether the alpha criterion has been met
    /// @return true if criterion has been met, else false
    function alphaCriterionMet()
    public
    view
    returns (bool)
    {
        uint256 baseline = alphaByPhaseNumber(verificationPhaseNumber)
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount);
        return verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount >= baseline;
    }

    /// @notice Gauge whether the beta criterion has been met
    /// @return true if criterion has been met, else false
    function betaCriterionMet()
    public
    view
    returns (bool)
    {
        if (0 == verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount)
            return false;

        bool trueCriterionMet = verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[true]
        .mul(ConstantsLib.PARTS_PER())
        .div(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount)
        >= betaByPhaseNumber(verificationPhaseNumber);

        bool falseCriterionMet = verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[false]
        .mul(ConstantsLib.PARTS_PER())
        .div(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount)
        >= betaByPhaseNumber(verificationPhaseNumber);

        return trueCriterionMet || falseCriterionMet;
    }

    /// @notice Gauge whether the gamma criterion has been met
    /// @return true if criterion has been met, else false
    function gammaCriterionMet()
    public
    view
    returns (bool)
    {
        return verificationPhaseByPhaseNumber[verificationPhaseNumber].stakingWallets
        >= gammaByPhaseNumber(verificationPhaseNumber);
    }

    /// @notice Set the next alpha criterion
    /// @dev Only enabled when the resolution engine is not frozen
    /// @param _nextAlpha The next alpha
    function setNextAlpha(uint256 _nextAlpha)
    public
    onlyRoleAccessor(OWNER_ROLE)
    onlyNotFrozen
    {
        // Set the alpha
        nextAlpha = _nextAlpha;

        // Emit event
        emit NextAlphaSet(nextAlpha);
    }

    /// @notice Set the next beta criterion
    /// @dev Only enabled when the resolution engine is not frozen
    /// @param _nextBeta The next beta
    function setNextBeta(uint256 _nextBeta)
    public
    onlyRoleAccessor(OWNER_ROLE)
    onlyNotFrozen
    {
        // Set the beta
        nextBeta = _nextBeta;

        // Emit event
        emit NextBetaSet(nextBeta);
    }

    /// @notice Set the next gamma criterion
    /// @dev Only enabled when the resolution engine is not frozen
    /// @param _nextGamma The next gamma
    function setNextGamma(uint256 _nextGamma)
    public
    onlyRoleAccessor(OWNER_ROLE)
    onlyNotFrozen
    {
        // Set the gamma
        nextGamma = _nextGamma;

        // Emit event
        emit NextGammaSet(nextGamma);
    }

    /// @notice Get the alpha parameter by the given verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @return the alpha value
    function alphaByPhaseNumber(uint256 _verificationPhaseNumber)
    public
    view
    returns (uint256)
    {
        return verificationPhaseByPhaseNumber[_verificationPhaseNumber].uintCriteria[ALPHA_INDEX];
    }
    
    /// @notice Get the beta parameter by the given verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @return the beta value
    function betaByPhaseNumber(uint256 _verificationPhaseNumber)
    public
    view
    returns (uint256)
    {
        return verificationPhaseByPhaseNumber[_verificationPhaseNumber].uintCriteria[BETA_INDEX];
    }

    /// @notice Get the gamma parameter by the given verification phase number
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @return the gamma value
    function gammaByPhaseNumber(uint256 _verificationPhaseNumber)
    public
    view
    returns (uint256)
    {
        return verificationPhaseByPhaseNumber[_verificationPhaseNumber].uintCriteria[GAMMA_INDEX];
    }

    /// @notice Augment the verification phase with verification criteria params
    function _addVerificationCriteria()
    internal
    {
        verificationPhaseByPhaseNumber[verificationPhaseNumber].uintCriteria.push(nextAlpha);
        verificationPhaseByPhaseNumber[verificationPhaseNumber].uintCriteria.push(nextBeta);
        verificationPhaseByPhaseNumber[verificationPhaseNumber].uintCriteria.push(nextGamma);
    }
}
