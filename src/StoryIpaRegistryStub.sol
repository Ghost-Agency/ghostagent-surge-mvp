// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Stub for Story Protocol IPA Registry. Returns a deterministic ipaId
///         derived from the token contract and token ID. Replace with real
///         Story Protocol integration when available on Gnosis Chain.
contract StoryIpaRegistryStub {
    event IpAssetRegistered(bytes32 indexed ipaId, address indexed tokenContract, uint256 indexed tokenId);

    function registerIpAsset(
        address tokenContract,
        uint256 tokenId,
        bytes calldata /* data */
    ) external returns (bytes32 ipaId) {
        ipaId = keccak256(abi.encodePacked(tokenContract, tokenId));
        emit IpAssetRegistered(ipaId, tokenContract, tokenId);
    }
}
