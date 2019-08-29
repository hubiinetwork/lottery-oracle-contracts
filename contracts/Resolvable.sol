/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

/// @title Resolvable
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolvable base contract
contract Resolvable {
    /// @notice Resolve the market in the current verification phase if resolution criteria have been met
    /// @dev The function can only be called by oracle.
    /// be the current verification phase number
    function resolveIfCriteriaMet()
    public;

    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false   
    function resolutionCriteriaMet()
    public
    view
    returns (bool);

    /// @notice Return the amount needed to resolve the market for the given verification phase number and status
    /// @param _verificationPhaseNumber The concerned verification phase number
    /// @param _status The concerned status
    /// @return the amount needed to obtain to resolve the market
    function resolutionDeltaAmount(uint256 _verificationPhaseNumber, bool _status)
    public
    view
    returns (uint256);
}
