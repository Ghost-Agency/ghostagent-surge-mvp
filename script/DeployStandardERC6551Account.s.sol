// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { StandardERC6551Account } from "../src/tokenbound/StandardERC6551Account.sol";

contract DeployStandardERC6551Account is Script {
    function run() external returns (address deployed) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        StandardERC6551Account impl = new StandardERC6551Account();
        vm.stopBroadcast();

        deployed = address(impl);
    }
}
