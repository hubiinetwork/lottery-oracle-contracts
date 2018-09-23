/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {RBACed} from "./RBACed.sol";
import {Oracle} from "./Oracle.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

library VerificationPhaseLib {

    struct VerificationPhase {
        mapping(bool => mapping(address => uint256)) statusWalletStakeMap;
    }

    function stake(VerificationPhase storage _phase, bool _status,
        address _wallet, uint256 _amount) internal {
        _phase.statusWalletStakeMap[_status][_wallet] = _amount;
    }
}

/// @title ResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine base contract
contract ResolutionEngine is RBACed {
    using VerificationPhaseLib for VerificationPhaseLib.VerificationPhase;

    event OracleSet(address indexed _oracle);
    event TokenSet(address indexed _token);
    event TokensStaked(uint256 _verificationPhaseNumber, address _wallet, uint256 _amount, bool _status);

    string constant public ORACLE_ROLE = "ORACLE";

    Oracle public oracle;

    ERC20 public token;

    uint256 public verificationPhaseNumber;
    mapping(uint256 => VerificationPhaseLib.VerificationPhase) private verificationPhaseMap;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor() public {
        addRoleInternal(ORACLE_ROLE);
    }

    /// @notice Set the oracle by its address
    /// @param _oracle The concerned oracle address
    function setOracle(address _oracle)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        oracle = Oracle(_oracle);
        addRoleAccessorInternal(ORACLE_ROLE, _oracle);
        emit OracleSet(_oracle);
    }

    /// @notice Set the token by its address
    /// @param _token The concerned token address
    function setToken(address _token)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        token = ERC20(_token);
        emit TokenSet(_token);
    }

    /// @notice For the current phase number stake the amount of tokens at the given status
    /// @dev Client has to do prior approval of the transfer of the given amount
    /// @param _wallet The concerned wallet
    /// @param _amount The amount staked
    /// @param _status The status staked at
    function stakeTokens(address _wallet, uint256 _amount, bool _status)
    public
    onlyRoleAccessor(ORACLE_ROLE)
    {
        token.transferFrom(_wallet, this, _amount);

        verificationPhaseMap[verificationPhaseNumber].stake(_status, _wallet, _amount);
        emit TokensStaked(verificationPhaseNumber, _wallet, _amount, _status);
    }
}
