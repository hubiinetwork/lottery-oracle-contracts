/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

/// @title Able
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A base contract that supports general enablement and disablement
/// @dev By default all is enabled
contract Able {
    event Disabled(string _name);
    event Enabled(string _name);

    mapping(string => bool) private _disabled;

    /// @notice Enable by the given name
    /// @param _name The name to enable
    function enable(string memory _name)
    public
    {
        // Require that the name is disabled
        require(_disabled[_name], "Able: name is enabled");

        // Enable name
        _disabled[_name] = false;

        // Emit event
        emit Enabled(_name);
    }

    /// @notice Disable by the given name
    /// @param _name The name to disable
    function disable(string memory _name)
    public
    {
        // Require that the name is enabled
        require(!_disabled[_name], "Able: name is disabled");

        // Disable name
        _disabled[_name] = true;

        // Emit event
        emit Disabled(_name);
    }

    /// @notice Gauge whether the name is enabled
    /// @param _name The name to gauge
    function enabled(string memory _name)
    public
    view
    returns (bool)
    {
        return !_disabled[_name];
    }

    /// @notice Gauge whether the name is disable
    /// @param _name The name to gauge
    function disabled(string memory _name)
    public
    view
    returns (bool)
    {
        return _disabled[_name];
    }

    modifier onlyEnabled(string memory _name) {
        require(enabled(_name), "Able: name is disabled");
        _;
    }

    modifier onlyDisabled(string memory _name) {
        require(disabled(_name), "Able: name is enabled");
        _;
    }
}