/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

library ConstantsLib {
    // Get the fraction that represents the entirety, equivalent of 100%
    function PARTS_PER()
    public
    pure
    returns (uint256)
    {
        return 1e18;
    }
}