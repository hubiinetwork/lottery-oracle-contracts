/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {Roles} from "openzeppelin-solidity/contracts/access/Roles.sol";

/// @title Ownable
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A base contract to support RBAC limited to one owner role
contract Ownable {
    using Roles for Roles.Role;

    event OwnerAdded(address indexed _address);
    event OwnerRemoved(address indexed _address);

    Roles.Role private owners;

    /// @notice `msg.sender` will be added to the set of owners
    constructor() public {
        owners.add(msg.sender);
    }

    modifier onlyOwner() {
        require(isOwner(msg.sender));
        _;
    }

    /// @notice Gauge whether an address is the one of a registered owner
    /// @param _address The concerned address
    /// @return true if address is the one of a registered owner, else false
    function isOwner(address _address) public view returns (bool) {
        return owners.has(_address);
    }

    /// @notice Register an address as owner
    /// @param _address The concerned address
    function addOwner(address _address) public onlyOwner {
        owners.add(_address);
        emit OwnerAdded(_address);
    }

    /// @notice Deregister an address as owner
    /// @param _address The concerned address
    function removeOwner(address _address) public onlyOwner {
        owners.remove(_address);
        emit OwnerRemoved(_address);
    }
}
