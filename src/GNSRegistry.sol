// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract GNSRegistry is Ownable {
    mapping(bytes32 node => address owner) public nodeOwner;
    mapping(address => bool) public authorisedCallers;

    event SubnodeOwnerSet(bytes32 indexed parentNode, bytes32 indexed label, bytes32 indexed subnode, address owner);
    event CallerAuthorised(address indexed caller, bool authorised);

    constructor() Ownable(msg.sender) {}

    function authoriseCaller(address caller, bool authorised) external onlyOwner {
        authorisedCallers[caller] = authorised;
        emit CallerAuthorised(caller, authorised);
    }

    function setSubnodeOwner(bytes32 parentNode, bytes32 label, address owner) external returns (bytes32 subnode) {
        require(authorisedCallers[msg.sender], "GNSRegistry: caller not authorised");
        subnode = keccak256(abi.encodePacked(parentNode, label));
        nodeOwner[subnode] = owner;
        emit SubnodeOwnerSet(parentNode, label, subnode, owner);
    }
}
