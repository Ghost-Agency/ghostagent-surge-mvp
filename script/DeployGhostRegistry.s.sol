// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { GhostRegistry } from "../src/GhostRegistry.sol";

contract DeployGhostRegistry is Script {
    function run() external returns (address deployed) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address erc6551Registry = vm.envAddress("ERC6551_REGISTRY");
        address erc6551Impl = vm.envAddress("ERC6551_ACCOUNT_IMPL");
        uint256 chainId = vm.envUint("CHAIN_ID");

        vm.startBroadcast(pk);
        GhostRegistry registry = new GhostRegistry(
            erc6551Registry,
            erc6551Impl,
            chainId
        );
        vm.stopBroadcast();

        deployed = address(registry);
    }
}
