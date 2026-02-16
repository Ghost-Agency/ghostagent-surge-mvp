// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { RegistrarFactory } from "../src/RegistrarFactory.sol";

contract TransferFactoryToSafe is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factory = vm.envAddress("FACTORY");
        address safeAddress = vm.envAddress("SAFE_ADDRESS");

        vm.startBroadcast(pk);
        RegistrarFactory(factory).transferOwnership(safeAddress);
        vm.stopBroadcast();
    }
}
