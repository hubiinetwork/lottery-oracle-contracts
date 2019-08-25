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
    /// @notice Gauge whether the resolution criteria have been met
    /// @return true if resolution criteria have been met, else false   
    function resolutionCriteriaMet() public view returns (bool);
}
