// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BaseRegistrar } from "./BaseRegistrar.sol";

contract NamespaceRegistrar is BaseRegistrar {
    bytes32 private immutable _parentNode;

    constructor(
        string memory name,
        string memory symbol,
        bytes32 parentNode_,
        address gnsRegistry,
        address storyIpaRegistry,
        address erc6551Registry,
        address erc6551AccountImplementation,
        uint256 chainId
    ) BaseRegistrar(
        name,
        symbol,
        gnsRegistry,
        storyIpaRegistry,
        erc6551Registry,
        erc6551AccountImplementation,
        chainId
    ) {
        _parentNode = parentNode_;
    }

    function parentNode() public view override returns (bytes32) {
        return _parentNode;
    }
}
