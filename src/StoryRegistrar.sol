// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IStoryIPAssetRegistry } from "./interfaces/IStoryIPAssetRegistry.sol";
import { IStoryLicenseRegistry } from "./interfaces/IStoryLicenseRegistry.sol";

/// @title StoryRegistrar
/// @notice Per-namespace .ip registrar that:
///   1. Mints an NFT representing the .ip subname (e.g. alice.creation.ip)
///   2. Registers it as an IP Asset on Story Protocol
///   3. Optionally attaches license terms
///
/// @dev Mirrors the GNO-side NamespaceRegistrar pattern but targets Story L1.
///      One StoryRegistrar is deployed per .ip SLD (creation.ip, moltbook.ip).
///      The source-chain NFT (on Gnosis) is referenced by chainId + tokenContract + tokenId.
contract StoryRegistrar is ERC721, Ownable {
    IStoryIPAssetRegistry public immutable ipAssetRegistry;
    IStoryLicenseRegistry public immutable licenseRegistry;

    /// @notice The parent .ip domain this registrar manages (e.g. "creation.ip")
    string public parentDomain;

    /// @notice The Gnosis chain ID for cross-chain IP registration
    uint256 public constant GNOSIS_CHAIN_ID = 100;

    /// @notice Default license template (PIL — Programmable IP License)
    address public licenseTemplate;

    /// @notice Default license terms ID
    uint256 public defaultLicenseTermsId;

    uint256 public nextTokenId;

    /// @notice Maps tokenId → subname label (e.g. "alice")
    mapping(uint256 => string) public names;

    /// @notice Maps label → tokenId
    mapping(string => uint256) public nameToId;

    /// @notice Maps tokenId → Story IP Account address
    mapping(uint256 => address) public ipAccountOf;

    /// @notice Maps tokenId → source-chain NFT contract (on Gnosis)
    mapping(uint256 => address) public sourceContract;

    /// @notice Maps tokenId → source-chain token ID (on Gnosis)
    mapping(uint256 => uint256) public sourceTokenId;

    event SubnameMinted(
        uint256 indexed tokenId,
        string label,
        string fullName,
        address indexed owner
    );

    event IpAssetRegistered(
        uint256 indexed tokenId,
        address indexed ipAccount,
        uint256 sourceChainId,
        address sourceTokenContract,
        uint256 sourceTokenId
    );

    event LicenseAttached(
        uint256 indexed tokenId,
        address indexed ipAccount,
        address licenseTemplate,
        uint256 licenseTermsId
    );

    constructor(
        string memory name_,
        string memory symbol_,
        string memory parentDomain_,
        address ipAssetRegistry_,
        address licenseRegistry_,
        address licenseTemplate_,
        uint256 defaultLicenseTermsId_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        ipAssetRegistry = IStoryIPAssetRegistry(ipAssetRegistry_);
        licenseRegistry = IStoryLicenseRegistry(licenseRegistry_);
        parentDomain = parentDomain_;
        licenseTemplate = licenseTemplate_;
        defaultLicenseTermsId = defaultLicenseTermsId_;
        nextTokenId = 1;
    }

    /// @notice Update the default license template and terms
    function setDefaultLicense(address template, uint256 termsId) external onlyOwner {
        licenseTemplate = template;
        defaultLicenseTermsId = termsId;
    }

    /// @notice Mint a .ip subname and register it as an IP Asset on Story Protocol
    /// @param label The subname label (e.g. "alice" for alice.creation.ip)
    /// @param owner The address to receive the .ip NFT
    /// @param gnosisTokenContract The NFT contract on Gnosis that this .ip maps to
    /// @param gnosisTokenId The token ID on Gnosis
    /// @param attachLicense Whether to attach default license terms
    /// @return tokenId The minted .ip NFT token ID
    /// @return ipAccount The Story Protocol IP Account address
    function mintSubname(
        string calldata label,
        address owner,
        address gnosisTokenContract,
        uint256 gnosisTokenId,
        bool attachLicense
    ) external returns (uint256 tokenId, address ipAccount) {
        require(bytes(label).length > 0, "Empty label");
        require(nameToId[label] == 0, "Name taken");

        // 1. Mint .ip NFT
        tokenId = nextTokenId++;
        _safeMint(owner, tokenId);
        names[tokenId] = label;
        nameToId[label] = tokenId;
        sourceContract[tokenId] = gnosisTokenContract;
        sourceTokenId[tokenId] = gnosisTokenId;

        string memory fullName = string.concat(label, ".", parentDomain);
        emit SubnameMinted(tokenId, label, fullName, owner);

        // 2. Register as IP Asset on Story Protocol
        //    References the Gnosis-side NFT for cross-chain provenance
        ipAccount = ipAssetRegistry.register(
            GNOSIS_CHAIN_ID,
            gnosisTokenContract,
            gnosisTokenId
        );
        ipAccountOf[tokenId] = ipAccount;

        emit IpAssetRegistered(tokenId, ipAccount, GNOSIS_CHAIN_ID, gnosisTokenContract, gnosisTokenId);

        // 3. Optionally attach license terms
        if (attachLicense && licenseTemplate != address(0)) {
            licenseRegistry.attachLicenseTerms(
                ipAccount,
                licenseTemplate,
                defaultLicenseTermsId
            );
            emit LicenseAttached(tokenId, ipAccount, licenseTemplate, defaultLicenseTermsId);
        }
    }

    /// @notice Mint a license token for an existing IP Asset
    /// @param tokenId The .ip NFT token ID
    /// @param amount Number of license tokens to mint
    /// @param receiver The address to receive the license tokens
    /// @return startLicenseTokenId The first minted license token ID
    function mintLicenseTokens(
        uint256 tokenId,
        uint256 amount,
        address receiver,
        bytes calldata royaltyContext
    ) external returns (uint256 startLicenseTokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        address ipAccount = ipAccountOf[tokenId];
        require(ipAccount != address(0), "Not registered");

        startLicenseTokenId = licenseRegistry.mintLicenseTokens(
            ipAccount,
            licenseTemplate,
            defaultLicenseTermsId,
            amount,
            receiver,
            royaltyContext
        );
    }

    /// @notice Get full info for a .ip subname
    function ipInfo(uint256 tokenId) external view returns (
        string memory label,
        string memory fullName,
        address owner,
        address ipAccount,
        address gnosisContract,
        uint256 gnosisId
    ) {
        require(ownerOf(tokenId) != address(0), "Token doesn't exist");
        label = names[tokenId];
        fullName = string.concat(label, ".", parentDomain);
        owner = ownerOf(tokenId);
        ipAccount = ipAccountOf[tokenId];
        gnosisContract = sourceContract[tokenId];
        gnosisId = sourceTokenId[tokenId];
    }

    /// @notice Get full info by label
    function ipInfoByName(string calldata label) external view returns (
        uint256 tokenId,
        string memory fullName,
        address owner,
        address ipAccount,
        address gnosisContract,
        uint256 gnosisId
    ) {
        tokenId = nameToId[label];
        require(ownerOf(tokenId) != address(0), "Name not registered");
        fullName = string.concat(label, ".", parentDomain);
        owner = ownerOf(tokenId);
        ipAccount = ipAccountOf[tokenId];
        gnosisContract = sourceContract[tokenId];
        gnosisId = sourceTokenId[tokenId];
    }
}
