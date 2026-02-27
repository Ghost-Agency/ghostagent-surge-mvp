// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import { GNSRegistry } from "../src/GNSRegistry.sol";
import { StoryIpaRegistryStub } from "../src/StoryIpaRegistryStub.sol";
import { RegistrarFactory } from "../src/RegistrarFactory.sol";
import { NamespaceRegistrar } from "../src/NamespaceRegistrar.sol";

contract RedeployAll is Script {
    function run() external {
        // Canonical ERC-6551 registry (already deployed on Gnosis)
        address erc6551Registry = 0x000000006551c19487814612e58FE06813775758;
        // MinimalERC6551Account (already deployed on Gnosis)
        address erc6551AccountImpl = 0x878E703A93b6e0aaD92f9907332c68fb09765697;
        // Gnosis chain ID
        uint256 chainId = 100;
        // Safe address (will receive ownership)
        address safe = 0xb7e493e3d226f8fE722CC9916fF164B793af13F4;

        vm.startBroadcast();

        // 1. Deploy GNS Registry
        GNSRegistry gns = new GNSRegistry();
        console.log("GNSRegistry:", address(gns));

        // 2. Deploy Story IPA Registry Stub
        StoryIpaRegistryStub story = new StoryIpaRegistryStub();
        console.log("StoryIpaRegistryStub:", address(story));

        // 3. Deploy new RegistrarFactory
        RegistrarFactory factory = new RegistrarFactory(
            address(gns),
            address(story),
            erc6551Registry,
            erc6551AccountImpl,
            chainId
        );
        console.log("RegistrarFactory:", address(factory));

        // 4. Deploy all 5 registrars
        address agentReg = factory.deployRegistrar("agent.gno", "Agent Registry", "AGENT");
        console.log("agent.gno registrar:", agentReg);

        address openclawReg = factory.deployRegistrar("openclaw.gno", "OpenClaw Registry", "OCLAW");
        console.log("openclaw.gno registrar:", openclawReg);

        address moltReg = factory.deployRegistrar("molt.gno", "Molt Registry", "MOLT");
        console.log("molt.gno registrar:", moltReg);

        address picoclawReg = factory.deployRegistrar("picoclaw.gno", "PicoClaw Registry", "PCLAW");
        console.log("picoclaw.gno registrar:", picoclawReg);

        address vaultReg = factory.deployRegistrar("vault.gno", "Vault Registry", "VAULT");
        console.log("vault.gno registrar:", vaultReg);

        address nftmailReg = factory.deployRegistrar("nftmail.gno", "NFTMail Registry", "NFTML");
        console.log("nftmail.gno registrar:", nftmailReg);

        // 5. Authorise all registrars to call GNS Registry
        gns.authoriseCaller(agentReg, true);
        gns.authoriseCaller(openclawReg, true);
        gns.authoriseCaller(moltReg, true);
        gns.authoriseCaller(picoclawReg, true);
        gns.authoriseCaller(vaultReg, true);
        gns.authoriseCaller(nftmailReg, true);

        // 6. Transfer registrar ownership to Safe
        //    (Safe can then call authoriseMinter to whitelist treasury wallets)
        NamespaceRegistrar(agentReg).transferOwnership(safe);
        NamespaceRegistrar(openclawReg).transferOwnership(safe);
        NamespaceRegistrar(moltReg).transferOwnership(safe);
        NamespaceRegistrar(picoclawReg).transferOwnership(safe);
        NamespaceRegistrar(vaultReg).transferOwnership(safe);
        NamespaceRegistrar(nftmailReg).transferOwnership(safe);
        console.log("All registrar ownership transferred to Safe");

        // 7. Transfer GNS Registry ownership to Safe
        gns.transferOwnership(safe);
        console.log("GNSRegistry ownership transferred to Safe");

        // 8. Transfer Factory ownership to Safe
        factory.transferOwnership(safe);
        console.log("Factory ownership transferred to Safe");

        vm.stopBroadcast();
    }
}
