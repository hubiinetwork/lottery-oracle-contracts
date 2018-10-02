/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {ERC20Mintable} from "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import {ERC20Detailed} from "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

/// @title StakeToken
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A token to be staked
contract StakeToken is ERC20Mintable, ERC20Detailed {
    constructor(string _name, string _symbol, uint8 _decimals) public ERC20Detailed(_name, _symbol, _decimals) {
    }
}
