/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {RBACed} from "./RBACed.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/// @title BountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A fund of bounties
contract BountyFund is RBACed {

    event TokensDeposited(address _wallet, uint256 _amount);
    event TokensWithdrawn(address _wallet, uint256 _amount);

    ResolutionEngine public resolutionEngine;
    ERC20 public token;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _resolutionEngine) public {
        resolutionEngine = ResolutionEngine(_resolutionEngine);
        resolutionEngine.setBountyFund(this);

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
        token.transferFrom(msg.sender, this, _amount);
        emit TokensDeposited(msg.sender, _amount);
    }

    /// @notice Transfer the amount of token to msg.sender
    /// @param _amount The amount to withdraw
    function withdrawTokens(uint256 _amount)
    public
    onlyRegisteredResolutionEngine
    {
        token.transfer(msg.sender, _amount);
        emit TokensWithdrawn(msg.sender, _amount);
    }
}
