// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { NamespaceRegistrar } from "./NamespaceRegistrar.sol";
import { Namehash } from "./utils/Namehash.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract RegistrarFactory is Ownable {
    address public immutable gnsRegistry;
    address public immutable storyIpaRegistry;
    address public immutable erc6551Registry;
    address public immutable erc6551AccountImplementation;
    uint256 public immutable chainId;

    mapping(bytes32 parentNode => address registrar) private _registrarByParentNode;

    event RegistrarDeployed(bytes32 indexed parentNode, address indexed registrar, string parentName);

    constructor(
        address gnsRegistry_,
        address storyIpaRegistry_,
        address erc6551Registry_,
        address erc6551AccountImplementation_,
        uint256 chainId_
    ) Ownable(msg.sender) {
        gnsRegistry = gnsRegistry_;
        storyIpaRegistry = storyIpaRegistry_;
        erc6551Registry = erc6551Registry_;
        erc6551AccountImplementation = erc6551AccountImplementation_;
        chainId = chainId_;
    }

    function registrarOf(bytes32 parentNode) external view returns (address) {
        return _registrarByParentNode[parentNode];
    }

    function deployRegistrar(
        string calldata parentName,
        string calldata registrarName,
        string calldata registrarSymbol
    ) external onlyOwner returns (address registrar) {
        bytes32 parentNode = Namehash.namehash(parentName);
        require(_registrarByParentNode[parentNode] == address(0), "Registrar exists");

        NamespaceRegistrar reg = new NamespaceRegistrar(
            registrarName,
            registrarSymbol,
            parentNode,
            gnsRegistry,
            storyIpaRegistry,
            erc6551Registry,
            erc6551AccountImplementation,
            chainId
        );

        registrar = address(reg);
        _registrarByParentNode[parentNode] = registrar;

        emit RegistrarDeployed(parentNode, registrar, parentName);
    }
}
