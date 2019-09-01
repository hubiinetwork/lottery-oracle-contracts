/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {RBACed} from "./RBACed.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @title BountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A fund of bounties
contract BountyFund is RBACed {
    using SafeMath for uint256;

    event ResolutionEngineSet(address indexed _resolutionEngine);
    event TokensDeposited(address indexed _wallet, uint256 _amount, uint256 _balance);
    event TokensWithdrawn(address indexed _wallet, uint256 _amount, uint256 _balance);

    uint256 constant public PARTS_PER = 1e18;

    ERC20 public token;
    ResolutionEngine public resolutionEngine;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _token)
    public
    {
        // Initialize token
        token = ERC20(_token);
    }

    modifier onlyRegisteredResolutionEngine() {
        require(msg.sender == address(resolutionEngine), "BountyFund: sender is not the set resolution engine");
        _;
    }

    /// @notice Set the resolution engine of this bounty fund
    /// @dev This function can only be called once
    /// @param _resolutionEngine The address of the concerned resolution engine
    function setResolutionEngine(address _resolutionEngine)
    public
    {
        require(address(0) != _resolutionEngine, "BountyFund: resolution engine argument is zero address");
        require(address(0) == address(resolutionEngine), "BountyFund: resolution engine has already been set");

        // Update resolution engine
        resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Emit event
        emit ResolutionEngineSet(_resolutionEngine);
    }

    /// @notice Deposit the amount of token
    /// @dev Client has to do prior approval of the transfer of the given amount
    /// @param _amount The amount to deposit
    function depositTokens(uint256 _amount)
    public
    {
        // Transfer tokens to this
        token.transferFrom(msg.sender, address(this), _amount);

        // Emit event
        emit TokensDeposited(msg.sender, _amount, token.balanceOf(address(this)));
    }

    /// @notice Transfer the fraction of balance of token to msg.sender
    /// @dev The entirety from which _fraction is subset
    /// @param _fraction The fraction of current balance to withdraw
    function withdrawTokens(uint256 _fraction)
    public
    onlyRegisteredResolutionEngine
    returns (uint256)
    {
        // Require that fraction is less than the entirety
        require(_fraction <= PARTS_PER, "BountyFund: fraction is greater than entirety");

        // Calculate amount to transfer
        uint256 amount = token.balanceOf(address(this)).mul(_fraction).div(PARTS_PER);

        // Transfer tokens to sender
        token.transfer(msg.sender, amount);

        // Emit event
        emit TokensWithdrawn(msg.sender, amount, token.balanceOf(address(this)));

        // Return calculated amount
        return amount;
    }
}
