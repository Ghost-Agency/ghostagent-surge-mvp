// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStoryIpaRegistry {
    function registerIpAsset(address tokenContract, uint256 tokenId, bytes calldata data) external returns (bytes32 ipaId);
}
