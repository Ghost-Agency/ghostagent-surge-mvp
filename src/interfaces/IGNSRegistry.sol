// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGNSRegistry {
    function setSubnodeOwner(bytes32 parentNode, bytes32 label, address owner) external returns (bytes32);
}
