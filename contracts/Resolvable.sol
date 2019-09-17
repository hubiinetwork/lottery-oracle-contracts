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
    function resolveIfCriteriaMet()
    public;

    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false   
    function resolutionCriteriaMet()
    public
    view
    returns (bool);

    /// @notice Return the amount needed to resolve the current market for the given status
    /// @param _status The concerned status
    /// @return the amount needed to obtain to resolve the market
    function resolutionDeltaAmount(bool _status)
    public
    view
    returns (uint256);
}
