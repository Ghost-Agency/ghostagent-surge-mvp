// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { StoryRegistrar } from "./StoryRegistrar.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title StoryRegistrarFactory
/// @notice Factory that deploys StoryRegistrar instances for each .ip SLD
///         (e.g. creation.ip, moltbook.ip). Mirrors the GNO-side RegistrarFactory
///         pattern but targets Story Protocol on Story L1.
contract StoryRegistrarFactory is Ownable {
    address public immutable ipAssetRegistry;
    address public immutable licenseRegistry;
    address public licenseTemplate;
    uint256 public defaultLicenseTermsId;

    mapping(bytes32 domainHash => address registrar) private _registrarByDomain;

    event RegistrarDeployed(string indexed parentDomain, address indexed registrar);
    event DefaultLicenseUpdated(address licenseTemplate, uint256 licenseTermsId);

    constructor(
        address ipAssetRegistry_,
        address licenseRegistry_,
        address licenseTemplate_,
        uint256 defaultLicenseTermsId_
    ) Ownable(msg.sender) {
        ipAssetRegistry = ipAssetRegistry_;
        licenseRegistry = licenseRegistry_;
        licenseTemplate = licenseTemplate_;
        defaultLicenseTermsId = defaultLicenseTermsId_;
    }

    /// @notice Update the default license template and terms for new registrars
    function setDefaultLicense(address template, uint256 termsId) external onlyOwner {
        licenseTemplate = template;
        defaultLicenseTermsId = termsId;
        emit DefaultLicenseUpdated(template, termsId);
    }

    /// @notice Look up the registrar for a given .ip domain
    function registrarOf(string calldata parentDomain) external view returns (address) {
        return _registrarByDomain[keccak256(bytes(parentDomain))];
    }

    /// @notice Deploy a new StoryRegistrar for a .ip SLD
    /// @param parentDomain The .ip domain (e.g. "creation.ip")
    /// @param registrarName ERC-721 name for the registrar (e.g. "Creation IP Registry")
    /// @param registrarSymbol ERC-721 symbol (e.g. "CIP")
    function deployRegistrar(
        string calldata parentDomain,
        string calldata registrarName,
        string calldata registrarSymbol
    ) external onlyOwner returns (address registrar) {
        bytes32 domainHash = keccak256(bytes(parentDomain));
        require(_registrarByDomain[domainHash] == address(0), "Registrar exists");

        StoryRegistrar reg = new StoryRegistrar(
            registrarName,
            registrarSymbol,
            parentDomain,
            ipAssetRegistry,
            licenseRegistry,
            licenseTemplate,
            defaultLicenseTermsId
        );

        registrar = address(reg);
        _registrarByDomain[domainHash] = registrar;

        emit RegistrarDeployed(parentDomain, registrar);
    }

    /// @notice Transfer ownership of a deployed registrar to a new owner (e.g. Safe)
    function transferRegistrarOwnership(string calldata parentDomain, address newOwner) external onlyOwner {
        bytes32 domainHash = keccak256(bytes(parentDomain));
        address reg = _registrarByDomain[domainHash];
        require(reg != address(0), "Registrar not found");
        StoryRegistrar(reg).transferOwnership(newOwner);
    }
}
