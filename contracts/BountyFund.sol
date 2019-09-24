/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {RBACed} from "./RBACed.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {Allocator} from "./Allocator.sol";

/// @title BountyFund
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A fund of bounties
contract BountyFund is RBACed {
    using SafeMath for uint256;

    event ResolutionEngineSet(address indexed _resolutionEngine);
    event TokensDeposited(address indexed _wallet, uint256 _amount, uint256 _balance);
    event TokensAllocated(address indexed _wallet, address indexed _allocator,
        uint256 _amount, uint256 _balance);
    event Withdrawn(address indexed _wallet, uint256 _amount);

    ERC20 public token;

    address public operator;
    address public resolutionEngine;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _token, address _operator)
    public
    {
        // Initialize token
        token = ERC20(_token);

        // Initialize operator
        operator = _operator;
    }

    modifier onlyResolutionEngine() {
        require(msg.sender == resolutionEngine, "BountyFund: sender is not the defined resolution engine");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "BountyFund: sender is not the defined operator");
        _;
    }

    /// @notice Set the resolution engine of this bounty fund
    /// @dev This function can only be called once
    /// @param _resolutionEngine The address of the concerned resolution engine
    function setResolutionEngine(address _resolutionEngine)
    public
    {
        require(address(0) != _resolutionEngine, "BountyFund: resolution engine argument is zero address");
        require(address(0) == resolutionEngine, "BountyFund: resolution engine has already been set");

        // Update resolution engine
        resolutionEngine = _resolutionEngine;

        // Emit event
        emit ResolutionEngineSet(_resolutionEngine);
    }

    /// @notice Deposit the amount of token
    /// @dev Client has to do prior approval of the transfer for the given amount
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
    /// @param _allocator The allocator that calculates the allocation
    function allocateTokens(address _allocator)
    public
    onlyResolutionEngine
    returns (uint256)
    {
        // Calculate amount to transfer
        uint256 amount = Allocator(_allocator).allocate();

        // Transfer tokens to sender
        token.transfer(msg.sender, amount);

        // Emit event
        emit TokensAllocated(msg.sender, _allocator, amount, token.balanceOf(address(this)));

        // Return calculated amount
        return amount;
    }

    /// @notice Withdraw the to the given address
    /// @param _wallet The recipient address of the bounty transfer
    function withdraw(address _wallet)
    public
    onlyOperator
    {
        // Determine amount to transfer
        uint256 amount = token.balanceOf(address(this));

        // Transfer tokens to wallet
        token.transfer(_wallet, amount);

        // Emit event
        emit Withdrawn(_wallet, amount);
    }
}
