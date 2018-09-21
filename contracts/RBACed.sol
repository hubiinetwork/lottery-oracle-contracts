/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {Roles} from "openzeppelin-solidity/contracts/access/Roles.sol";

/// @title RBACed (Role-Based Access Controlled)
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A base contract to support general RBAC of arbitrary number of roles
contract RBACed {
    using Roles for Roles.Role;

    event RoleAdded(string _role);
    event RoleAccessorAdded(string _role, address indexed _address);
    event RoleAccessorRemoved(string _role, address indexed _address);

    string constant public OWNER_ROLE = "OWNER";

    string[] public roles;
    mapping(bytes32 => uint256) roleIndexMap;
    mapping(bytes32 => Roles.Role) private roleAccessorsMap;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor() public {
        addRoleInternal(OWNER_ROLE);
        addRoleAccessorInternal(OWNER_ROLE, msg.sender);
    }

    modifier onlyRoleAccessor(string _role) {
        require(isRoleAccessor(_role, msg.sender));
        _;
    }

    /// @notice Get the count of roles
    /// @return The count of roles
    function rolesCount() public view returns (uint256) {
        return roles.length;
    }

    /// @notice Gauge whether a role is set
    /// @param _role The concerned role
    /// @return true if role has been set, else false
    function isRole(string _role) public view returns (bool) {
        return 0 != roleIndexMap[role2Key(_role)];
    }

    /// @notice Add role
    /// @param _role The concerned role
    function addRole(string _role) public onlyRoleAccessor(OWNER_ROLE) {
        addRoleInternal(_role);
        emit RoleAdded(_role);
    }

    /// @notice Gauge whether an address is an accessor of a role
    /// @param _role The concerned role
    /// @param _address The concerned address
    /// @return true if address is the one of a registered accessor of role, else false
    function isRoleAccessor(string _role, address _address) public view returns (bool) {
        return roleAccessorsMap[role2Key(_role)].has(_address);
    }

    /// @notice Register an address as accessor of a role
    /// @param _role The concerned role
    /// @param _address The concerned address
    function addRoleAccessor(string _role, address _address) public onlyRoleAccessor(OWNER_ROLE) {
        addRoleAccessorInternal(_role, _address);
        emit RoleAccessorAdded(_role, _address);
    }

    /// @notice Deregister an address as accessor of a role
    /// @param _role The concerned role
    /// @param _address The concerned address
    function removeRoleAccessor(string _role, address _address) public onlyRoleAccessor(OWNER_ROLE) {
        roleAccessorsMap[role2Key(_role)].remove(_address);
        emit RoleAccessorRemoved(_role, _address);
    }

    function addRoleInternal(string _role) internal {
        roles.push(_role);
        roleIndexMap[role2Key(_role)] = roles.length;
    }

    function addRoleAccessorInternal(string _role, address _address) internal {
        roleAccessorsMap[role2Key(_role)].add(_address);
    }

    function role2Key(string _role) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_role));
    }
}
