/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Allocator} from "./Allocator.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {BountyFund} from "./BountyFund.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/// @title FractionalBalanceAllocator
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A bounty allocator allocating by fraction of the bounty fund's token balance
contract FractionalBalanceAllocator is Allocator {
    using SafeMath for uint256;

    uint256 constant public PARTS_PER = 1e18; // The entirety, 100%

    BountyFund public bountyFund;

    uint256 public fraction;

    ERC20 public token;

    constructor(address _bountyFund, uint256 _fraction)
    public
    {
        // Require that fraction is less than the entirety
        require(_fraction <= PARTS_PER, "FractionalBalanceAllocator: fraction is greater than entirety");

        // Initialize bounty fund
        bountyFund = BountyFund(_bountyFund);

        // Initialize fraction
        fraction = _fraction;

        // Initialize token to the one of bounty fund
        token = ERC20(bountyFund.token());
    }

    /// @notice Return the defined allocation from the allocator
    function allocate()
    public
    view
    returns (uint256)
    {
        return token.balanceOf(address(bountyFund)).mul(fraction).div(PARTS_PER);
    }
}