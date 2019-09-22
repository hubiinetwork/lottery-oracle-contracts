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

        uint256 stakedAmount;
        mapping(bool => uint256) stakedAmountByStatus;
        mapping(address => mapping(bool => uint256)) stakedAmountByWalletStatus;
        mapping(uint256 => mapping(bool => uint256)) stakedAmountByBlockStatus;

        mapping(address => bool) stakedByWallet;
        uint256 stakingWallets;

        uint256 bountyAmount;
        bool bountyAwarded;

        uint256 startBlock;
        uint256 endBlock;

        uint256[] uintCriteria;
    }

    function open(VerificationPhase storage _phase, uint256 _bountyAmount) internal {
        _phase.state = State.Opened;
        _phase.bountyAmount = _bountyAmount;
        _phase.startBlock = block.number;
    }

    function close(VerificationPhase storage _phase) internal {
        _phase.state = State.Closed;
        _phase.endBlock = block.number;
        if (_phase.stakedAmountByStatus[true] > _phase.stakedAmountByStatus[false])
            _phase.result = Status.True;
        else if (_phase.stakedAmountByStatus[true] < _phase.stakedAmountByStatus[false])
            _phase.result = Status.False;
    }

    function stake(VerificationPhase storage _phase, address _wallet,
        bool _status, uint256 _amount) internal {
        _phase.stakedAmount = _phase.stakedAmount.add(_amount);
        _phase.stakedAmountByStatus[_status] = _phase.stakedAmountByStatus[_status].add(_amount);
        _phase.stakedAmountByWalletStatus[_wallet][_status] =
        _phase.stakedAmountByWalletStatus[_wallet][_status].add(_amount);
        _phase.stakedAmountByBlockStatus[block.number][_status] =
        _phase.stakedAmountByBlockStatus[block.number][_status].add(_amount);

        if (!_phase.stakedByWallet[_wallet]) {
            _phase.stakedByWallet[_wallet] = true;
            _phase.stakingWallets = _phase.stakingWallets.add(1);
        }
    }
}
