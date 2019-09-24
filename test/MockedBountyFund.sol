
/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Allocator} from "../contracts/Allocator.sol";

/// @title MockedBountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of bounty fund
contract MockedBountyFund {

    address public token;
    address public resolutionEngine;

    address public _tokenAllocateWallet;
    uint256 private _allocation;
    address public _withdrawWallet;

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
        _tokenAllocateWallet = msg.sender;
        return _allocation;
    }

    function _allocateTokens(address _allocator)
    public
    view
    returns (uint256)
    {
        return Allocator(_allocator).allocate();
    }

    function _setAllocation(uint256 allocation)
    public
    {
        _allocation = allocation;
    }

    function withdraw(address _wallet)
    public
    {
        _withdrawWallet = _wallet;
    }
}
