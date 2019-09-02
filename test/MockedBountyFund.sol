/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

/// @title MockedBountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of bounty fund
contract MockedBountyFund {

    address public token;
    address public resolutionEngine;

    address public _tokenAllocatee;
    uint256 private _allocation;

    function _setToken(address _token)
    public
    {
        token = _token;
    }

    function setResolutionEngine(address _resolutionEngine)
    public
    {
        resolutionEngine = _resolutionEngine;
    }

    function allocateTokens(address)
    public
    returns (uint256)
    {
        _tokenAllocatee = msg.sender;
        return _allocation;
    }

    function _setAllocation(uint256 allocation)
    public
    {
        _allocation = allocation;
    }
}
