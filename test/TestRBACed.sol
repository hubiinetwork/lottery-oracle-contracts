/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {RBACed} from "../contracts/RBACed.sol";

/// @title TestOwnable
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice An RBACed only to be tested on
contract TestRBACed is RBACed {
    constructor() public {
    }
}
