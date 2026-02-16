// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { RegistrarFactory } from "../src/RegistrarFactory.sol";

contract DeployRegistrarFactory is Script {
    function run() external returns (address deployed) {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = vm.parseUint(pkStr);

        address gnsRegistry = vm.envAddress("GNS_REGISTRY");
        address storyIpaRegistry = vm.envAddress("STORY_IPA_REGISTRY");
        address erc6551Registry = vm.envAddress("ERC6551_REGISTRY");
        address erc6551Impl = vm.envAddress("ERC6551_ACCOUNT_IMPL");
        uint256 chainId = vm.envUint("CHAIN_ID");

        vm.startBroadcast(pk);
        RegistrarFactory factory = new RegistrarFactory(
            gnsRegistry,
            storyIpaRegistry,
            erc6551Registry,
            erc6551Impl,
            chainId
        );
        vm.stopBroadcast();

        deployed = address(factory);
    }
}
