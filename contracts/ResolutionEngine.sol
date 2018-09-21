/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {RBACed} from "./RBACed.sol";
import {Oracle} from "./Oracle.sol";

/// @title ResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine base contract
contract ResolutionEngine is RBACed {

    event OracleSet(address indexed _address);

    string constant public ORACLE_ROLE = "ORACLE";

    Oracle public oracle;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor() public {
        addRoleInternal(ORACLE_ROLE);
    }

    /// @notice Gauge whether an address is the one of the set oracle
    /// @param _address The concerned address
    /// @return true if address is the one of the set oracle, else false
    function isSetOracle(address _address) public view returns (bool) {
        return _address == address(oracle);
    }

    /// @notice Set the oracle by its address
    /// @param _address The concerned address
    function setOracle(address _address) public onlyRoleAccessor(OWNER_ROLE) {
        oracle = Oracle(_address);
        addRoleAccessorInternal(ORACLE_ROLE, _address);
        emit OracleSet(_address);
    }
}
