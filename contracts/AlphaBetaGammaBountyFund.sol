/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {BountyFund} from "./BountyFund.sol";

/// @title AlphaBetaGammaBountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A fund of bounties of the alpha-beta-gamma resolution engine
contract AlphaBetaGammaBountyFund is BountyFund {
    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _token)
    BountyFund(_token)
    public
    {
    }
}
