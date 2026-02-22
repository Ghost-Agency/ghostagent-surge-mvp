// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IStoryIPAssetRegistry } from "./interfaces/IStoryIPAssetRegistry.sol";

/// @title StorySubRegistrar
/// @notice Lean registrar that maps [name].creation.ip → same TBA address from Gnosis.
///         Zero split, zero migration — the portable identity bundle travels as-is.
///
///         Flow:
///           1. User mints alice.agent.gno on Gnosis → gets TBA 0xABC...
///           2. Backend calls mintSubdomain("alice", 0xABC...) on Story L1
///           3. Story registry now maps alice.creation.ip → 0xABC... (same TBA)
///           4. IP Asset registered on Story Protocol for provenance
contract StorySubRegistrar is ERC721, Ownable {
    IStoryIPAssetRegistry public immutable ipAssetRegistry;

    /// @notice The parent domain this registrar manages (e.g. "creation.ip")
    string public parentDomain;

    /// @notice Gnosis chain ID for cross-chain IP registration
    uint256 public constant GNOSIS_CHAIN_ID = 100;

    uint256 public nextTokenId;

    /// @notice tokenId → subname label
    mapping(uint256 => string) public names;

    /// @notice label → tokenId
    mapping(string => uint256) public nameToId;

    /// @notice tokenId → TBA address (same deterministic address from Gnosis)
    mapping(uint256 => address) public tbaOf;

    /// @notice tokenId → Story IP Account address
    mapping(uint256 => address) public ipAccountOf;

    /// @notice TBA address → tokenId (reverse lookup)
    mapping(address => uint256) public tokenByTba;

    event SubdomainMinted(
        uint256 indexed tokenId,
        string name,
        string fullDomain,
        address indexed tba,
        address indexed owner
    );

    event IpAssetRegistered(
        uint256 indexed tokenId,
        address indexed ipAccount,
        address indexed tba
    );

    constructor(
        string memory name_,
        string memory symbol_,
        string memory parentDomain_,
        address ipAssetRegistry_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        ipAssetRegistry = IStoryIPAssetRegistry(ipAssetRegistry_);
        parentDomain = parentDomain_;
        nextTokenId = 1;
    }

    /// @notice Mint [name].creation.ip and map it to the same TBA from Gnosis
    /// @param name The subdomain label (e.g. "alice" for alice.creation.ip)
    /// @param tbaAddress The deterministic TBA address from Gnosis (portable)
    /// @return tokenId The minted NFT token ID
    /// @return ipAccount The Story Protocol IP Account address
    function mintSubdomain(
        string calldata name,
        address tbaAddress
    ) external onlyOwner returns (uint256 tokenId, address ipAccount) {
        require(bytes(name).length > 0, "Empty name");
        require(nameToId[name] == 0, "Name taken");
        require(tbaAddress != address(0), "Invalid TBA");
        require(tokenByTba[tbaAddress] == 0, "TBA already mapped");

        // 1. Mint .ip subdomain NFT to the TBA itself (it owns its own identity)
        tokenId = nextTokenId++;
        _safeMint(tbaAddress, tokenId);

        names[tokenId] = name;
        nameToId[name] = tokenId;
        tbaOf[tokenId] = tbaAddress;
        tokenByTba[tbaAddress] = tokenId;

        string memory fullDomain = string.concat(name, ".", parentDomain);
        emit SubdomainMinted(tokenId, name, fullDomain, tbaAddress, tbaAddress);

        // 2. Register as IP Asset on Story Protocol
        //    References this contract + tokenId on Story L1 itself
        ipAccount = ipAssetRegistry.register(
            block.chainid,
            address(this),
            tokenId
        );
        ipAccountOf[tokenId] = ipAccount;

        emit IpAssetRegistered(tokenId, ipAccount, tbaAddress);
    }

    /// @notice Look up full info by name
    function lookup(string calldata name) external view returns (
        uint256 tokenId,
        string memory fullDomain,
        address tba,
        address ipAccount
    ) {
        tokenId = nameToId[name];
        require(tokenId != 0, "Not registered");
        fullDomain = string.concat(name, ".", parentDomain);
        tba = tbaOf[tokenId];
        ipAccount = ipAccountOf[tokenId];
    }

    /// @notice Look up full info by TBA address
    function lookupByTba(address tba) external view returns (
        uint256 tokenId,
        string memory name,
        string memory fullDomain,
        address ipAccount
    ) {
        tokenId = tokenByTba[tba];
        require(tokenId != 0, "TBA not mapped");
        name = names[tokenId];
        fullDomain = string.concat(name, ".", parentDomain);
        ipAccount = ipAccountOf[tokenId];
    }
}
