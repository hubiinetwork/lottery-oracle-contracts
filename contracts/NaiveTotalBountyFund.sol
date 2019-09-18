/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {BountyFund} from "./BountyFund.sol";

/// @title NaiveTotalBountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A fund of bounties of the naïve total resolution engine
contract NaiveTotalBountyFund is BountyFund {
    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _token)
    BountyFund(_token)
    public
    {
    }
}
