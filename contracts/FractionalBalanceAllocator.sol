/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {Allocator} from "./Allocator.sol";
import {RBACed} from "./RBACed.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {BountyFund} from "./BountyFund.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {ConstantsLib} from "./ConstantsLib.sol";

/// @title FractionalBalanceAllocator
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A bounty allocator allocating by fraction of the bounty fund's token balance
contract FractionalBalanceAllocator is Allocator, RBACed {
    using SafeMath for uint256;

    event Frozen();
    event FractionSet(uint256 _fraction);

    uint256 public fraction;
    bool public frozen;

    constructor(uint256 _fraction)
    public
    {
        // Require that fraction is less than the entirety
        require(_fraction <= ConstantsLib.PARTS_PER(),
            "FractionalBalanceAllocator: fraction is greater than entirety");

        // Initialize fraction
        fraction = _fraction;
    }

    modifier onlyNotFrozen() {
        require(!frozen, "FractionalBalanceAllocator: is frozen");
        _;
    }

    /// @notice Freeze updates this allocator
    /// @dev This operation can not be undone
    function freeze()
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Set the frozen flag
        frozen = true;

        // Emit event
        emit Frozen();
    }

    /// @notice Set the fraction
    /// @param _fraction The fraction to be set
    function setFraction(uint256 _fraction)
    public
    onlyRoleAccessor(OWNER_ROLE)
    onlyNotFrozen
    {
        // Require that fraction is less than the entirety
        require(_fraction <= ConstantsLib.PARTS_PER(),
            "FractionalBalanceAllocator: fraction is greater than entirety");

        // Set the fraction
        fraction = _fraction;

        // Emit event
        emit FractionSet(fraction);
    }

    /// @notice Return the defined allocation from the allocator
    function allocate()
    public
    view
    returns (uint256)
    {
        return BountyFund(msg.sender).token()
        .balanceOf(address(msg.sender))
        .mul(fraction)
        .div(ConstantsLib.PARTS_PER());
    }
}