/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {RBACed} from "./RBACed.sol";
import {BountyFund} from "./BountyFund.sol";

// TODO Remove
/// @title BountyFundFactory
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A factory of instances
contract BountyFundFactory is RBACed {

    address[] public instances;
    mapping(address => address[]) public instancesByOwner;

    event Created(address indexed _bountyFund, address indexed owner);

    /// @notice Create an instance of bounty fund
    /// @param _token The address of the bounty fund's token
    /// @return the address of the bounty fund created
    function create(address _token)
    public
    returns (address)
    {
        // Instantiate bounty fund
        BountyFund bountyFund = new BountyFund(_token, address(0));

        // Add owner role accessor
        bountyFund.addRoleAccessor(OWNER_ROLE, msg.sender);

        address bountyFundAddress = address(bountyFund);

        // Emit event
        emit Created(bountyFundAddress, msg.sender);

        // Store the address of the instance
        instances.push(bountyFundAddress);
        instancesByOwner[msg.sender].push(bountyFundAddress);

        // Return address of the instance
        return bountyFundAddress;
    }

    /// @notice Get the count of instances created
    /// @return the count of instances
    function instancesCount()
    public
    view
    returns (uint256)
    {
        return instances.length;
    }

    /// @notice Get all instances created
    /// @return all instances
    function allInstances()
    public
    view
    returns (address[] memory)
    {
        return instances;
    }

    /// @notice Get the count of instances created with the given owner
    /// @param _owner The concerned owner
    /// @return the count of instances with the given owner
    function instancesByOwnerCount(address _owner)
    public
    view
    returns (uint256)
    {
        return instancesByOwner[_owner].length;
    }

    /// @notice Get all instances created with the given owner
    /// @param _owner The concerned owner
    /// @return all instances with the given owner
    function allInstancesByOwner(address _owner)
    public
    view
    returns (address[] memory)
    {
        return instancesByOwner[_owner];
    }
}
