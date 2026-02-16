// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { NftSigner } from "../src/NftSigner.sol";

/// @notice Deploy an NftSigner instance bound to a specific ERC-721 token.
///
///   Required env vars:
///     PRIVATE_KEY      – deployer private key
///     KEY_TOKEN        – address of the ERC-721 contract (the .gno registrar)
///     KEY_TOKEN_ID     – tokenId of the specific agent key NFT
contract DeployNftSigner is Script {
    function run() external returns (address deployed) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address keyToken = vm.envAddress("KEY_TOKEN");
        uint256 keyTokenId = vm.envUint("KEY_TOKEN_ID");

        vm.startBroadcast(pk);
        NftSigner signer = new NftSigner(keyToken, keyTokenId);
        vm.stopBroadcast();

        deployed = address(signer);
    }
}
