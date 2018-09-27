/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {RBACed} from "./RBACed.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @title BountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A fund of bounties
contract BountyFund is RBACed {
    using SafeMath for uint256;

    event TokensDeposited(address indexed _wallet, uint256 _amount, uint256 _balance);
    event TokensWithdrawn(address indexed _wallet, uint256 _amount, uint256 _balance);

    uint256 constant public PARTS_PER = 1e18;

    ResolutionEngine public resolutionEngine;
    ERC20 public token;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _resolutionEngine) public {
        // Initialize resolution engine
        resolutionEngine = ResolutionEngine(_resolutionEngine);
        resolutionEngine.setBountyFund(this);

        // Initialize token
        token = ERC20(resolutionEngine.token());
    }

    modifier onlyRegisteredResolutionEngine() {
        require(msg.sender == address(resolutionEngine));
        _;
    }

    /// @notice Deposit the amount of token
    /// @dev Client has to do prior approval of the transfer of the given amount
    /// @param _amount The amount to deposit
    function depositTokens(uint256 _amount)
    public
    {
        // Transfer tokens to this
        token.transferFrom(msg.sender, this, _amount);

        // Emit event
        emit TokensDeposited(msg.sender, _amount, token.balanceOf(this));
    }

    /// @notice Transfer the fraction of balance of token to msg.sender
    /// @dev The entirety from which _fraction is subset
    /// @param _fraction The fraction of current balance to withdraw
    function withdrawTokens(uint256 _fraction)
    public
    onlyRegisteredResolutionEngine
    returns (uint256)
    {
        // Calculate amount to transfer
        uint256 amount = token.balanceOf(this).mul(_fraction).div(PARTS_PER);

        // Transfer tokens to sender
        token.transfer(msg.sender, amount);

        // Emit event
        emit TokensWithdrawn(msg.sender, amount, token.balanceOf(this));

        // Return calculated amount
        return amount;
    }
}
