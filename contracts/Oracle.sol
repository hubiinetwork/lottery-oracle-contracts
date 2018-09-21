/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

pragma solidity ^0.4.25;

import {Ownable} from "./Ownable.sol";
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
            _engines.list[_engines.map[key] - 1] = _engines.list[_engines.list.length - 1];
            delete _engines.list[_engines.list.length - 1];
            // TODO Consider whether this statement is obsolete
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
contract Oracle is Ownable {
    using ResolutionEnginesLib for ResolutionEnginesLib.ResolutionEngines;

    event ResolutionEngineAdded(address indexed _address);
    event ResolutionEngineRemoved(address indexed _address);

    ResolutionEnginesLib.ResolutionEngines resolutionEngines;

    /// @notice `msg.sender` will be added to the set of owners
    constructor() public {
    }

    /// @notice Gauge whether an address is the one of a registered owner
    /// @param _address The concerned address
    /// @return true if address is registered owner, else false
    function hasResolutionEngine(address _address) public view returns (bool) {
        return resolutionEngines.has(_address);
    }

    /// @notice Register a resolution engine by its address
    /// @param _address The concerned address
    function addResolutionEngine(address _address) public onlyOwner {
        resolutionEngines.add(_address);
        emit ResolutionEngineAdded(_address);
    }

    /// @notice Deregister a resolution engine by its address
    /// @param _address The concerned address
    function removeResolutionEngine(address _address) public onlyOwner {
        resolutionEngines.remove(_address);
        emit ResolutionEngineRemoved(_address);
    }
}
