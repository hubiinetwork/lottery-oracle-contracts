/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

import {RBACed} from "./RBACed.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";
import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/// @title ResolutionEnginesLib
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A library to ease the oracle's management of resolution engines
library ResolutionEnginesLib {

    struct ResolutionEngines {
        mapping(bytes32 => uint256) map;
        ResolutionEngine[] list;
    }

    function has(ResolutionEngines storage _engines, address _address) internal view returns (bool) {
        return (0 != _engines.map[address2Key(_address)]);
    }

    function add(ResolutionEngines storage _engines, address _address) internal {
        ResolutionEngine engine = ResolutionEngine(_address);
        bytes32 key = address2Key(_address);
        if (_engines.map[key] == 0) {
            _engines.list.push(engine);
            _engines.map[key] = _engines.list.length;
        }
    }

    function remove(ResolutionEngines storage _engines, address _address) internal {
        bytes32 key = address2Key(_address);
        if (_engines.map[key] != 0) {
            if (_engines.map[key] < _engines.list.length) {
                _engines.list[_engines.map[key] - 1] = _engines.list[_engines.list.length - 1];
                _engines.map[address2Key(address(_engines.list[_engines.map[key] - 1]))] = _engines.map[key];
                delete _engines.list[_engines.list.length - 1];
            }
            _engines.list.length--;
            _engines.map[key] = 0;
        }
    }

    function address2Key(address _address) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_address));
    }
}

/// @title Oracle
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A lottery oracle
contract Oracle is RBACed {
    using SafeMath for uint256;
    using ResolutionEnginesLib for ResolutionEnginesLib.ResolutionEngines;

    event ResolutionEngineAdded(address indexed _resolutionEngine);
    event ResolutionEngineRemoved(address indexed _resolutionEngine);
    event TokensStaked(address indexed _wallet, address indexed _resolutionEngine,
        bool _status, uint256 _amount);
    event PayoutStaged(address indexed _wallet, address indexed _resolutionEngine,
        uint256 _firstVerificationPhaseNumber, uint256 _lastVerificationPhaseNumber);
    event Withdrawn(address indexed _wallet, address indexed _resolutionEngine,
        uint256 _amount);

    ResolutionEnginesLib.ResolutionEngines resolutionEngines;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor()
    public
    {
    }

    modifier onlyRegisteredResolutionEngine(address _resolutionEngine) {
        require(hasResolutionEngine(_resolutionEngine));
        _;
    }

    /// @notice Gauge whether an address is the one of a registered resolution engine
    /// @param _resolutionEngine The concerned address
    /// @return true if address is the one of a registered resolution engine, else false
    function hasResolutionEngine(address _resolutionEngine)
    public
    view
    returns
    (bool)
    {
        return resolutionEngines.has(_resolutionEngine);
    }

    /// @notice Return the count of registered resolution engines
    /// @return The count of registered resolution engines
    function resolutionEnginesCount()
    public
    view
    returns (uint256)
    {
        return resolutionEngines.list.length;
    }

    /// @notice Register a resolution engine by its address
    /// @param _resolutionEngine The concerned address
    function addResolutionEngine(address _resolutionEngine)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Add resolution engine
        resolutionEngines.add(_resolutionEngine);

        // Emit event
        emit ResolutionEngineAdded(_resolutionEngine);
    }

    /// @notice Deregister a resolution engine by its address
    /// @param _resolutionEngine The concerned address
    function removeResolutionEngine(address _resolutionEngine)
    public
    onlyRoleAccessor(OWNER_ROLE)
    {
        // Remove resolution engine
        resolutionEngines.remove(_resolutionEngine);

        // Emit event
        emit ResolutionEngineRemoved(_resolutionEngine);
    }

    /// @notice For the given resolution engine and verification phase number stake the amount of tokens
    /// at the given status
    /// @dev Client has to do prior approval of the transfer of the given amount
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _verificationPhaseNumber The verification phase number to stake into
    /// @param _amount The amount staked
    /// @param _status The status staked at
    function stake(address _resolutionEngine, uint256 _verificationPhaseNumber, bool _status, uint256 _amount)
    public
    onlyRegisteredResolutionEngine(_resolutionEngine)
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Require that stake targets current verification phase number
        require(resolutionEngine.verificationPhaseNumber() == _verificationPhaseNumber);

        // Calculate the amount overshooting the resolution delta amount
        uint256 refundAmount = _amount > resolutionEngine.resolutionDeltaAmount(_verificationPhaseNumber, _status) ?
        _amount.sub(resolutionEngine.resolutionDeltaAmount(_verificationPhaseNumber, _status)) :
        0;

        // Initialize token
        ERC20 token = ERC20(resolutionEngine.token());

        // TODO Consider allowing the RE to transfer itself and hence just approve of RE to transfer _amount
        // Transfer from msg.sender to this resolution engine
        token.transferFrom(msg.sender, _resolutionEngine, _amount);

        // Stage for refund the amount overshooting the resolution delta amount
        if (refundAmount > 0)
            resolutionEngine.stage(msg.sender, refundAmount);

        // Update the current verification phase metrics post transfer
        resolutionEngine.updateMetrics(msg.sender, _status, _amount.sub(refundAmount));

        // Possibly resolve market in the current verification phase if resolution criteria have been met
        resolutionEngine.resolveIfCriteriaMet();

        // Emit event
        emit TokensStaked(msg.sender, _resolutionEngine, _status, _amount);
    }

    /// @notice For the given resolution engine and inclusive verification phase number range stage payout
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _firstVerificationPhaseNumber The first verification phase number to stage payout from
    /// @param _lastVerificationPhaseNumber The last verification phase number to stage payout from
    function stagePayout(address _resolutionEngine, uint256 _firstVerificationPhaseNumber,
        uint256 _lastVerificationPhaseNumber)
    public
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Withdraw payout from resolution engine
        resolutionEngine.stagePayout(msg.sender, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber);

        // Emit event
        emit PayoutStaged(msg.sender, _resolutionEngine, _firstVerificationPhaseNumber, _lastVerificationPhaseNumber);
    }

    /// @notice For the given resolution engine withdraw the given amount
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _amount The amount to be withdrawn
    function withdraw(address _resolutionEngine, uint256 _amount)
    public
    {
        // Initialize resolution engine
        ResolutionEngine resolutionEngine = ResolutionEngine(_resolutionEngine);

        // Withdraw payout from resolution engine
        resolutionEngine.withdraw(msg.sender, _amount);

        // Emit event
        emit Withdrawn(msg.sender, _resolutionEngine, _amount);
    }
}
