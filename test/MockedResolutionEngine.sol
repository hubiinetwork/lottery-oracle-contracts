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
    event TokensStaked(address _this, uint256 _verificationPhaseNumber, address _wallet, bool _status, uint256 _amount);

    mapping(address => mapping(bool => uint256)) public stakes;

    constructor() public {
    }

    function stakeTokens(address _wallet, uint256 _verificationPhaseNumber, bool _status, uint256 _amount) public {
        stakes[_wallet][_status] = _amount;
        emit TokensStaked(address(this), _verificationPhaseNumber, _wallet, _status, _amount);
    }
}
