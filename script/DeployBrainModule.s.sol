// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import { BrainModule } from "../src/BrainModule.sol";

/// @notice Deploy BrainModule on Gnosis (chainId 100)
///         "Attach agent = install Brain module into Safe →
///          Safe now owns Brain → agent starts receiving/sending A2A email."
contract DeployBrainModule is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);

        BrainModule brain = new BrainModule();
        console.log("BrainModule:", address(brain));

        // Transfer ownership to Safe (emergency suspend/resume)
        address safe = 0xb7e493e3d226f8fE722CC9916fF164B793af13F4;
        brain.transferOwnership(safe);
        console.log("Ownership transferred to Safe");

        vm.stopBroadcast();
    }
}
