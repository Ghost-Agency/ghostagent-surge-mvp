// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import { StorySubRegistrar } from "../src/StorySubRegistrar.sol";

/// @notice Deploy StorySubRegistrar → maps [name].creation.ip → same TBA address
///         → zero split, zero migration.
contract DeployStorySubRegistrar is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        // Story Protocol Mainnet IP Asset Registry
        address ipAssetRegistry = 0x77319B4031e6eF1250907aa00018B8B1c67a244b;

        // Safe that will receive ownership (treasury pays gas)
        address safe = 0xb7e493e3d226f8fE722CC9916fF164B793af13F4;

        vm.startBroadcast(pk);

        StorySubRegistrar registrar = new StorySubRegistrar(
            "Creation IP SubRegistrar",
            "CRIP",
            "creation.ip",
            ipAssetRegistry
        );
        console.log("StorySubRegistrar (creation.ip):", address(registrar));

        // Transfer ownership to Safe (treasury calls mintSubdomain)
        registrar.transferOwnership(safe);
        console.log("Ownership transferred to Safe");

        vm.stopBroadcast();
    }
}
