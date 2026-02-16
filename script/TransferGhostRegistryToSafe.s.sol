// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { GhostRegistry } from "../src/GhostRegistry.sol";

contract TransferGhostRegistryToSafe is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address registry = vm.envAddress("GHOSTAGENT_REGISTRY");
        address safeAddress = vm.envAddress("SAFE_ADDRESS");

        vm.startBroadcast(pk);
        GhostRegistry(registry).transferOwnership(safeAddress);
        vm.stopBroadcast();
    }
}
