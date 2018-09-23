/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {ERC20Mintable} from "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

/// @title TestToken
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A test token
contract TestToken is ERC20Mintable {
    constructor() public {
    }
}
