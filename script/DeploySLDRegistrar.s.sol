// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { NamespaceRegistrar } from "../src/NamespaceRegistrar.sol";
import { RegistrarFactory } from "../src/RegistrarFactory.sol";
import { Namehash } from "../src/utils/Namehash.sol";

contract DeploySLDRegistrar is Script {
    function run() external returns (address deployed) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        string memory parentName = vm.envString("PARENT_NAME");
        string memory registrarName = string.concat(parentName, " Registrar");
        try vm.envString("REGISTRAR_NAME") returns (string memory v) {
            registrarName = v;
        } catch {}

        string memory registrarSymbol = "NSN";
        try vm.envString("REGISTRAR_SYMBOL") returns (string memory v) {
            registrarSymbol = v;
        } catch {}

        address gnsRegistry = vm.envAddress("GNS_REGISTRY");
        address storyIpaRegistry = vm.envAddress("STORY_IPA_REGISTRY");
        address erc6551Registry = vm.envAddress("ERC6551_REGISTRY");
        address erc6551Impl = vm.envAddress("ERC6551_ACCOUNT_IMPL");
        uint256 chainId = vm.envUint("CHAIN_ID");

        address factoryAddress = address(0);
        try vm.envAddress("FACTORY") returns (address v) {
            factoryAddress = v;
        } catch {}

        bytes32 parentNode = Namehash.namehash(parentName);

        vm.startBroadcast(pk);
        if (factoryAddress != address(0)) {
            deployed = RegistrarFactory(factoryAddress).deployRegistrar(parentName, registrarName, registrarSymbol);
        } else {
            NamespaceRegistrar reg = new NamespaceRegistrar(
                registrarName,
                registrarSymbol,
                parentNode,
                gnsRegistry,
                storyIpaRegistry,
                erc6551Registry,
                erc6551Impl,
                chainId
            );
            deployed = address(reg);
        }
        vm.stopBroadcast();
    }
}
