/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {BountyFund} from "../contracts/BountyFund.sol";

/// @title MockedResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of resolution engine
contract MockedResolutionEngine {
    event TokensStaked(address _this, uint256 _verificationPhaseNumber, address _wallet, bool _status, uint256 _amount);

    mapping(address => mapping(bool => uint256)) public stakes;
    address public token;
    BountyFund public bountyFund;

    constructor() public {
    }

    function setToken(address _token) public {
        token = _token;
    }

    function setBountyFund(address _bountyFund) public {
        bountyFund = BountyFund(_bountyFund);
    }

    function stakeTokens(address _wallet, uint256 _verificationPhaseNumber, bool _status, uint256 _amount) public {
        stakes[_wallet][_status] = _amount;
        emit TokensStaked(address(this), _verificationPhaseNumber, _wallet, _status, _amount);
    }

    function _withdrawTokens(uint256 _fraction) public {
        bountyFund.withdrawTokens(_fraction);
    }
}
