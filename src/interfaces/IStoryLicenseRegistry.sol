// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface for Story Protocol's License Registry (Story L1, chainId 1513)
/// @dev See https://docs.storyprotocol.xyz/docs/license-registry
interface IStoryLicenseRegistry {
    /// @notice Attach license terms to an IP Asset
    /// @param ipId The IP Account address
    /// @param licenseTemplate The license template contract address
    /// @param licenseTermsId The ID of the license terms to attach
    function attachLicenseTerms(
        address ipId,
        address licenseTemplate,
        uint256 licenseTermsId
    ) external;

    /// @notice Mint a license token for an IP Asset
    /// @param licensorIpId The IP Account that is licensing
    /// @param licenseTemplate The license template contract address
    /// @param licenseTermsId The ID of the license terms
    /// @param amount Number of license tokens to mint
    /// @param receiver The address to receive the license token
    /// @param royaltyContext Encoded royalty context data
    /// @return startLicenseTokenId The first minted license token ID
    function mintLicenseTokens(
        address licensorIpId,
        address licenseTemplate,
        uint256 licenseTermsId,
        uint256 amount,
        address receiver,
        bytes calldata royaltyContext
    ) external returns (uint256 startLicenseTokenId);
}
