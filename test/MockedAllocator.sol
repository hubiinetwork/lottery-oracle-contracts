/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Allocator} from "../contracts/Allocator.sol";

/// @title MockedAllocator
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of allocator
contract MockedAllocator is Allocator {

    uint256 private _allocation;

    function allocate()
    external
    view
    returns (uint256)
    {
        return _allocation;
    }

    function _setAllocation(uint256 allocation)
    public
    {
        _allocation = allocation;
    }
}
