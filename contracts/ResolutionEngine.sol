/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {Ownable} from "./Ownable.sol";
import {Oracle} from "./Oracle.sol";

/// @title ResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine base contract
contract ResolutionEngine is Ownable {

    event OracleSet(address indexed _address);

    Oracle public oracle;

    /// @notice `msg.sender` will be added to the set of owners
    constructor() public {
    }

    modifier onlyOracle() {
        require(isSetOracle(msg.sender));
        _;
    }

    /// @notice Gauge whether an address is the one of the set oracle
    /// @param _address The concerned address
    /// @return true if address is the one of the set oracle, else false
    function isSetOracle(address _address) public view returns (bool) {
        return _address == address(oracle);
    }

    /// @notice Set the oracle by its address
    /// @param _address The concerned address
    function setOracle(address _address) public onlyOwner {
        oracle = Oracle(_address);
        emit OracleSet(_address);
    }
}
