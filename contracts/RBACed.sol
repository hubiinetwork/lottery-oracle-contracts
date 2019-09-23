/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

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
    mapping(bytes32 => uint256) roleIndexByName;
    mapping(bytes32 => Roles.Role) private roleByName;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor()
    public
    {
        // Add role
        _addRole(OWNER_ROLE);

        // Add role accessor
        _addRoleAccessor(OWNER_ROLE, msg.sender);
    }

    modifier onlyRoleAccessor(string memory _role) {
        require(isRoleAccessor(_role, msg.sender), "RBACed: sender is not accessor of the role");
        _;
    }

    /// @notice Get the count of roles
    /// @return the count of roles
    function rolesCount()
    public
    view
    returns (uint256)
    {
        return roles.length;
    }

    /// @notice Gauge whether a role is set
    /// @param _role The concerned role
    /// @return true if role has been set, else false
    function isRole(string memory _role)
    public
    view
    returns (bool)
    {
        return 0 != roleIndexByName[_role2Key(_role)];
    }

    /// @notice Add role
    /// @param _role The concerned role
    function addRole(string memory _role)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Add role
        _addRole(_role);

        // Emit event
        emit RoleAdded(_role);
    }

    /// @notice Gauge whether an address is an accessor of a role
    /// @param _role The concerned role
    /// @param _address The concerned address
    /// @return true if address is the one of a registered accessor of role, else false
    function isRoleAccessor(string memory _role, address _address)
    public
    view
    returns (bool)
    {
        return roleByName[_role2Key(_role)].has(_address);
    }

    /// @notice Register an address as accessor of a role
    /// @param _role The concerned role
    /// @param _address The concerned address
    function addRoleAccessor(string memory _role, address _address)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Add role accessor
        _addRoleAccessor(_role, _address);

        // Emit event
        emit RoleAccessorAdded(_role, _address);
    }

    /// @notice Deregister an address as accessor of a role
    /// @param _role The concerned role
    /// @param _address The concerned address
    function removeRoleAccessor(string memory _role, address _address)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Remove role accessor
        roleByName[_role2Key(_role)].remove(_address);

        // Emit event
        emit RoleAccessorRemoved(_role, _address);
    }

    function _addRole(string memory _role)
    internal
    {
        if (0 == roleIndexByName[_role2Key(_role)]) {
            roles.push(_role);
            roleIndexByName[_role2Key(_role)] = roles.length;
        }
    }

    function _addRoleAccessor(string memory _role, address _address)
    internal
    {
        roleByName[_role2Key(_role)].add(_address);
    }

    function _role2Key(string memory _role)
    internal
    pure
    returns (bytes32)
    {
        return keccak256(abi.encodePacked(_role));
    }
}
