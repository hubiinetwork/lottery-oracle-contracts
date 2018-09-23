/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

/// @title MockedResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of resolution engine
contract MockedResolutionEngine {
    mapping(address => mapping(uint256 => bool)) public stakes;

    constructor() public {
    }

    function stakeTokens(address _wallet, uint256 _amount, bool _status) public {
        stakes[_wallet][_amount] = _status;
    }
}
