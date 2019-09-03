/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

pragma solidity ^0.5.11;

/// @title AddressStoreLib
/// @author Jens Ivar Jørdre <jensivar@hubii.com>
/// @notice A library to ease the management of addresses
library AddressStoreLib {

    struct Addresses {
        mapping(bytes32 => uint256) map;
        address[] list;
    }

    function has(Addresses storage _addresses, address _address) internal view returns (bool) {
        return (0 != _addresses.map[address2Key(_address)]);
    }

    function add(Addresses storage _addresses, address _address) internal {
        bytes32 key = address2Key(_address);
        if (_addresses.map[key] == 0) {
            _addresses.list.push(_address);
            _addresses.map[key] = _addresses.list.length;
        }
    }

    function remove(Addresses storage _addresses, address _address) internal {
        bytes32 key = address2Key(_address);
        if (_addresses.map[key] != 0) {
            if (_addresses.map[key] < _addresses.list.length) {
                _addresses.list[_addresses.map[key] - 1] = _addresses.list[_addresses.list.length - 1];
                _addresses.map[address2Key(address(_addresses.list[_addresses.map[key] - 1]))] = _addresses.map[key];
                delete _addresses.list[_addresses.list.length - 1];
            }
            _addresses.list.length--;
            _addresses.map[key] = 0;
        }
    }

    function address2Key(address _address) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_address));
    }
}