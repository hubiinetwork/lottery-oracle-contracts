/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/// @title MockedBountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A mock of bounty fund
contract MockedBountyFund {

    ERC20 public token;

    function _setToken(ERC20 _token)
    public
    {
        token = _token;
    }
}
