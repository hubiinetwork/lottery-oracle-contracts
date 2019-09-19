/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {RBACed} from "./RBACed.sol";
import {FractionalBalanceAllocator} from "./FractionalBalanceAllocator.sol";

/// @title FractionalBalanceAllocatorFactory
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A factory of fractional balance allocators
contract FractionalBalanceAllocatorFactory is RBACed {

    address[] public instances;

    event Created(address indexed _fractionalBalanceAllocator);

    /// @notice Create an instance of fractional balance allocator
    /// @param _fraction The fraction of the fractional bounty allocator
    // @return The address of the fractional balance allocator created
    function create(uint256 _fraction)
    public
    returns (address)
    {
        // Instantiate fractional balance allocator
        FractionalBalanceAllocator fractionalBalanceAllocator = new FractionalBalanceAllocator(_fraction);

        address fractionalBalanceAllocatorAddress = address(fractionalBalanceAllocator);

        // Emit event
        emit Created(fractionalBalanceAllocatorAddress);

        // Store the address of the instance
        instances.push(fractionalBalanceAllocatorAddress);

        // Return address of the instance
        return fractionalBalanceAllocatorAddress;
    }

    // @notice Get the count of instances created
    // @return The count of instances
    function instancesCount()
    public
    view
    returns (uint256)
    {
        return instances.length;
    }

    // @notice Get all instances created
    // @return All instances
    function allInstances()
    public
    view
    returns (address[] memory)
    {
        return instances;
    }
}
