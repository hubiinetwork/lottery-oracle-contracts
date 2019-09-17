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

    uint256 public alpha;
    uint256 public beta;
    uint256 public gamma;

    /// @notice `msg.sender` will be added as accessor to the owner role
    /// @param _oracle The address of oracle
    /// @param _operator The address of operator
    /// @param _bountyFund The address of bounty fund
    /// @param _alpha The alpha criterion of this resolution engine
    /// @param _beta The beta criterion of this resolution engine
    /// @param _gamma The gamma criterion of this resolution engine
    constructor(address _oracle, address _operator, address _bountyFund,
        uint256 _alpha, uint256 _beta, uint256 _gamma)
    public
    ResolutionEngine(_oracle, _operator, _bountyFund)
    {
        alpha = _alpha;
        beta = _beta;
        gamma = _gamma;
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
        uint256 scaledBountyAmount = alpha.mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount);
        return (
        scaledBountyAmount > verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount ?
        scaledBountyAmount.sub(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount) :
        0);
    }

    /// @notice Return the amount needed to resolve the beta criterion for the given status
    /// @param _status The concerned status
    /// @return the amount needed to obtain to resolve the beta criterion
    function betaResolutionDeltaAmount(bool _status)
    public
    view
    returns (uint256)
    {
        uint256 scaledStakedAmount = beta
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount);
        uint256 scaledStatusStakedAmount = ConstantsLib.PARTS_PER()
        .mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[_status]);
        return (
        scaledStatusStakedAmount < scaledStakedAmount ?
        scaledStakedAmount.sub(scaledStatusStakedAmount).div(ConstantsLib.PARTS_PER().sub(beta)) :
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
        return gamma.sub(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakingWallets);
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
        uint256 baseline = alpha.mul(verificationPhaseByPhaseNumber[verificationPhaseNumber].bountyAmount);
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
        .div(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount) >= beta;

        bool falseCriterionMet = verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmountByStatus[false]
        .mul(ConstantsLib.PARTS_PER())
        .div(verificationPhaseByPhaseNumber[verificationPhaseNumber].stakedAmount) >= beta;

        return trueCriterionMet || falseCriterionMet;
    }

    /// @notice Gauge whether the gamma criterion has been met
    /// @return true if criterion has been met, else false
    function gammaCriterionMet()
    public
    view
    returns (bool)
    {
        return verificationPhaseByPhaseNumber[verificationPhaseNumber].stakingWallets >= gamma;
    }
}
