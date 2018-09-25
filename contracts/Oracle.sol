/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {RBACed} from "./RBACed.sol";
import {ResolutionEngine} from "./ResolutionEngine.sol";

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
    using ResolutionEnginesLib for ResolutionEnginesLib.ResolutionEngines;

    event ResolutionEngineAdded(address indexed _resolutionEngine);
    event ResolutionEngineRemoved(address indexed _resolutionEngine);
    event TokensStaked(address _resolutionEngine, address _wallet, bool _status, uint256 _amount);

    ResolutionEnginesLib.ResolutionEngines resolutionEngines;

    /// @notice `msg.sender` will be added as accessor to the owner role
    constructor() public {
    }

    modifier onlyRegisteredResolutionEngine(address _resolutionEngine) {
        require(hasResolutionEngine(_resolutionEngine));
        _;
    }

    /// @notice Gauge whether an address is the one of a registered resolution engine
    /// @param _resolutionEngine The concerned address
    /// @return true if address is the one of a registered resolution engine, else false
    function hasResolutionEngine(address _resolutionEngine) public view returns (bool) {
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

    /// @notice For the current phase number of the given resolution engine stake the amount of tokens at the given status
    /// @dev Client has to do prior approval of the transfer of the given amount
    /// @param _resolutionEngine The concerned resolution engine
    /// @param _verificationPhaseNumber The verification phase number to stake into
    /// @param _amount The amount staked
    /// @param _status The status staked at
    function stakeTokens(address _resolutionEngine, uint256 _verificationPhaseNumber, bool _status, uint256 _amount)
    public
    onlyRegisteredResolutionEngine(_resolutionEngine)
    {
        // Call resolution engine stake tokens by means of delegate call
        bytes4 signature = bytes4(keccak256("stakeTokens(address,uint256,bool,uint256)"));
        require(_resolutionEngine.delegatecall(signature, msg.sender, _verificationPhaseNumber, _status, _amount));

        // Emit event
        emit TokensStaked(_resolutionEngine, msg.sender, _status, _amount);
    }
}
