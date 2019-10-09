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

/// @title BergenResolutionEngine
/// @author Mark Briscombe <mark@hubii.com> & Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine with criteria of Total Stake Amount relative to Bounty,
///   Directional Stake Fraction and Total Staking Wallets Count
/// Resolve the staking market when:
/// - The total number of tokens staked on the market is >= alpha times the number of tokens posted for the Bounty AND;
/// - The percentage of tokens staked on either option across the market is >= beta % AND;
/// - The total number of addresses staking tokens is >= gamma
contract BergenResolutionEngine is Resolvable, ResolutionEngine {

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

    /// @notice Return the amount to be staked by the next wallet to resolve the current market for the given status
    /// @param _status The concerned status
    /// @return the amount needed to obtain to resolve the market
    function resolutionDeltaAmount(bool _status)
    public
    view
    returns (uint256)
    {
        // Obtain the partial delta amounts
        uint256 alphaDeltaAmount = alphaResolutionDeltaAmount();
        uint256 betaDeltaAmount = betaResolutionDeltaAmount(_status);
        uint256 gammaDeltaAmount = gammaResolutionDeltaAmount();

        return Math.max(alphaDeltaAmount, Math.max(betaDeltaAmount, gammaDeltaAmount));
    }

    /// @notice Return the amount to be staked by the next wallet to resolve the alpha criterion
    /// @return the amount required to resolve the alpha criterion
    function alphaResolutionDeltaAmount()
    public
    view
    returns (uint256)
    {
        // Obtain alpha * bounty amount
        uint256 scaledBountyAmount = alphaByPhaseNumber(verificationPhaseNumber)
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount);

        // Return the difference of scaled bounty amount and staked amount if positive, else 0
        return scaledBountyAmount > verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount ?
        scaledBountyAmount.sub(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount) :
        0;
    }

    /// @notice Return the amount to be staked by the next wallet to resolve the beta criterion for the given status
    /// @param _status The concerned status
    /// @return the amount required to resolve the beta criterion
    ///
    /// With E, A and a respectively representing the entirety (100%) value, the total amount staked and
    /// the amount staked on the given status the initial delta amount is calculated as
    ///
    ///    delta = (beta * A - E * a) / (E - beta)
    ///
    /// If there is a non-zero remainder in the calculation the delta is incremented by an additional unit
    function betaResolutionDeltaAmount(bool _status)
    public
    view
    returns (uint256)
    {
        // Obtain beta * total amount staked
        uint256 scaledStakedAmount = betaByPhaseNumber(verificationPhaseNumber)
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount);

        // Obtain entirety * directional amount staked
        uint256 scaledStatusStakedAmount = ConstantsLib.PARTS_PER()
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[_status]);

        // If scaled amounts are exactly equal return 0
        if (scaledStakedAmount <= scaledStatusStakedAmount)
            return 0;

        // Else calculate the delta and add 1 for round off error
        else {
            uint256 scaledAmountsDiff = scaledStakedAmount.sub(scaledStatusStakedAmount);
            uint256 dividend = ConstantsLib.PARTS_PER().sub(betaByPhaseNumber(verificationPhaseNumber));

            // Calculate the minimum delta
            uint256 delta = scaledAmountsDiff.div(dividend);

            // Add 1 to delta if the above calculation left a remainder
            if (0 != scaledAmountsDiff.mod(dividend))
                delta = delta.add(1);

            return delta;
        }
    }

    /// @notice Return the amount to be staked by the next wallet to resolve the gamma criterion
    /// @return the amount required to resolve the beta criterion
    ///
    /// The gamma criterion is not monetary. Hence the value set of the criterion's resolution delta amount
    /// is binary. I.e. either the next wallet can stake an infinite amount (the total supply of the token) and
    /// still not meet the criterion, or else the next wallet can stake 0 and still meet the criterion.
    function gammaResolutionDeltaAmount()
    public
    view
    returns (uint256)
    {
        return
        verificationPhaseByPhaseNumber[verificationPhaseNumber].stakingWallets.add(1)
        >= gammaByPhaseNumber(verificationPhaseNumber) ?
        0 :
        token.totalSupply();
    }

    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false
    function resolutionCriteriaMet()
    public
    view
    returns (bool)
    {
        // Return true only if all partial criteria have been met
        return alphaCriterionMet() && betaCriterionMet() && gammaCriterionMet();
    }

    /// @notice Gauge whether the alpha criterion has been met
    /// @return true if criterion has been met, else false
    function alphaCriterionMet()
    public
    view
    returns (bool)
    {
        // Obtain the baseline as alpha * bounty amount
        uint256 baseline = alphaByPhaseNumber(verificationPhaseNumber)
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount);

        // Return true if the staked amount is greater than or equal to the baseline
        return verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount >= baseline;
    }

    /// @notice Gauge whether the beta criterion has been met
    /// @return true if criterion has been met, else false
    function betaCriterionMet()
    public
    view
    returns (bool)
    {
        // Return false if nothing was staked
        if (0 == verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount)
            return false;

        // Determine whether true criterion was met
        bool trueCriterionMet = verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[true]
        .mul(ConstantsLib.PARTS_PER())
        .div(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount)
        >= betaByPhaseNumber(verificationPhaseNumber);

        // Determine whether false criterion was met
        bool falseCriterionMet = verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[false]
        .mul(ConstantsLib.PARTS_PER())
        .div(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount)
        >= betaByPhaseNumber(verificationPhaseNumber);

        // Return true if either or both directional criteria are met
        return trueCriterionMet || falseCriterionMet;
    }

    /// @notice Gauge whether the gamma criterion has been met
    /// @return true if criterion has been met, else false
    function gammaCriterionMet()
    public
    view
    returns (bool)
    {
        // Return true if the number of staking wallets is greater than or equal to gamma
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
