// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface for Story Protocol's IP Asset Registry (Story L1, chainId 1513)
/// @dev See https://docs.storyprotocol.xyz/docs/ip-asset-registry
interface IStoryIPAssetRegistry {
    /// @notice Register an NFT as an IP Asset on Story Protocol
    /// @param chainId The chain where the NFT lives (e.g. 100 for Gnosis)
    /// @param tokenContract The NFT contract address on the source chain
    /// @param tokenId The NFT token ID
    /// @return ipId The IP Account address (deterministic, same as TBA pattern)
    function register(
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address ipId);

    /// @notice Check if an IP Asset is already registered
    function isRegistered(address ipId) external view returns (bool);

    /// @notice Get the IP Account address for an NFT (without registering)
    function ipId(
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address);
}
