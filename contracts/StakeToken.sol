/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {ERC20Mintable} from "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

/// @title StakeToken
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A token to be staked
contract StakeToken is ERC20Mintable {
    constructor() public {
    }
}
