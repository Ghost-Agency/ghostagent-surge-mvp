// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { ERC6551AccountImpl } from "../src/ERC6551AccountImpl.sol";

contract DeployERC6551AccountImpl is Script {
    function run() external returns (address deployed) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        ERC6551AccountImpl impl = new ERC6551AccountImpl();
        vm.stopBroadcast();

        deployed = address(impl);
    }
}
