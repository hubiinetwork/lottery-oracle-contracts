/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {Ownable} from "../contracts/Ownable.sol";

/// @title TestOwnable
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice An ownable only to be tested on
contract TestOwnable is Ownable {
    constructor() public {
    }
}
