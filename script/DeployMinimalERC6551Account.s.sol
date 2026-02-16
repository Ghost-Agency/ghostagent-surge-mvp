// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { MinimalERC6551Account } from "../src/MinimalERC6551Account.sol";

contract DeployMinimalERC6551Account is Script {
    function run() external returns (address deployed) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        MinimalERC6551Account impl = new MinimalERC6551Account();
        vm.stopBroadcast();

        deployed = address(impl);
    }
}
