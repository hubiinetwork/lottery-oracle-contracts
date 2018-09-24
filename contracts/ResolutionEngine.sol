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

    function stake(VerificationPhase storage _phase, address _wallet,
        bool _status, uint256 _amount) internal {
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
    event TokensStaked(uint256 _verificationPhaseNumber, address _wallet, bool _status, uint256 _amount);

    string constant public ORACLE_ROLE = "ORACLE";

    Oracle public oracle;
    ERC20 public token;

    uint256 public verificationPhaseNumber;
    mapping(uint256 => VerificationPhaseLib.VerificationPhase) private verificationPhaseMap;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor(address _oracle, address _token) public {
        oracle = Oracle(_oracle);
        token = ERC20(_token);
        addRoleInternal(ORACLE_ROLE);
        addRoleAccessorInternal(ORACLE_ROLE, _oracle);
    }

    modifier onlyCurrentPhaseNumber(uint256 _verificationPhaseNumber) {
        require(verificationPhaseNumber == _verificationPhaseNumber);
        _;
    }

    /// @notice For the current phase number stake the amount of tokens at the given status
    /// @dev Client has to do prior approval of the transfer of the given amount
    /// @param _wallet The concerned wallet
    /// @param _verificationPhaseNumber The verification phase number to stake into
    /// @param _status The status staked at
    /// @param _amount The amount staked
    function stakeTokens(address _wallet, uint256 _verificationPhaseNumber, bool _status, uint256 _amount)
    public
    onlyRoleAccessor(ORACLE_ROLE)
    onlyCurrentPhaseNumber(_verificationPhaseNumber)
    {
        token.transferFrom(_wallet, this, _amount);

        verificationPhaseMap[_verificationPhaseNumber].stake(_wallet, _status, _amount);

        emit TokensStaked(_verificationPhaseNumber, _wallet, _status, _amount);
    }
}
