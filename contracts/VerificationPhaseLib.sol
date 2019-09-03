/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @title ResolutionEngine
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A resolution engine base contract
library VerificationPhaseLib {
    using SafeMath for uint256;

    enum State {Unopened, Opened, Closed}
    enum Status {Null, True, False}

    struct VerificationPhase {
        State state;
        Status result;

        mapping(bool => uint256) amountByStatus;

        mapping(address => bool) stakedByWallet;
        uint256 stakingWallets;

        mapping(address => mapping(bool => uint256)) stakedAmountByWalletStatus;
        mapping(uint256 => mapping(bool => uint256)) stakedAmountByBlockStatus;

        uint256 bountyAmount;
        bool bountyAwarded;

        uint256 startBlock;
        uint256 endBlock;
    }

    function open(VerificationPhase storage _phase, uint256 _bountyAmount) internal {
        _phase.state = State.Opened;
        _phase.bountyAmount = _bountyAmount;
        _phase.startBlock = block.number;
    }

    function close(VerificationPhase storage _phase) internal {
        _phase.state = State.Closed;
        _phase.endBlock = block.number;
        if (_phase.amountByStatus[true] > _phase.amountByStatus[false])
            _phase.result = Status.True;
        else if (_phase.amountByStatus[true] < _phase.amountByStatus[false])
            _phase.result = Status.False;
    }

    function stake(VerificationPhase storage _phase, address _wallet,
        bool _status, uint256 _amount) internal {

        _phase.amountByStatus[_status] = _phase.amountByStatus[_status].add(_amount);

        if (!_phase.stakedByWallet[_wallet]) {
            _phase.stakedByWallet[_wallet] = true;
            _phase.stakingWallets++;
        }

        _phase.stakedAmountByWalletStatus[_wallet][_status] = _phase.stakedAmountByWalletStatus[_wallet][_status].add(_amount);
        _phase.stakedAmountByBlockStatus[block.number][_status] = _phase.stakedAmountByBlockStatus[block.number][_status].add(_amount);
    }
}
