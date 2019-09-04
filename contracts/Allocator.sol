/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

/// @title Allocator
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice An allocator interface
interface Allocator {
    /// @notice Return the defined allocation from the allocator
    function allocate()
    external
    view
    returns (uint256);
}
