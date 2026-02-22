// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import { StoryRegistrarFactory } from "../src/StoryRegistrarFactory.sol";

/// @notice Deploys the StoryRegistrarFactory on Story L1 (chainId 1513)
///         then deploys registrars for creation.ip and moltbook.ip
contract DeployStoryFactory is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        // Story Protocol Mainnet core contracts
        // Source: https://docs.story.foundation/developers/deployed-smart-contracts
        address ipAssetRegistry  = 0x77319B4031e6eF1250907aa00018B8B1c67a244b;
        address licenseRegistry  = 0x529a750E02d8E2f15649c13D69a465286a780e24;
        address licenseTemplate  = 0x2E896b0b2Fdb7457499B56AAaA4AE55BCB4Cd316; // PILicenseTemplate
        uint256 defaultLicenseTermsId = 1; // Non-Commercial Social Remixing

        // Safe that holds nftmail.gno and will receive factory ownership
        address safe = 0xb7e493e3d226f8fE722CC9916fF164B793af13F4;

        vm.startBroadcast(pk);

        // 1. Deploy StoryRegistrarFactory
        StoryRegistrarFactory factory = new StoryRegistrarFactory(
            ipAssetRegistry,
            licenseRegistry,
            licenseTemplate,
            defaultLicenseTermsId
        );
        console.log("StoryRegistrarFactory:", address(factory));

        // 2. Deploy creation.ip registrar
        //    Maps to: agent.gno, openclaw.gno, picoclaw.gno, vault.gno, nftmail.gno
        //    Pattern: minting alice.agent.gno on Gnosis → alice.creation.ip on Story
        address creationReg = factory.deployRegistrar(
            "creation.ip",
            "Creation IP Registry",
            "CIP"
        );
        console.log("creation.ip registrar:", creationReg);

        // 3. Deploy moltbook.ip registrar
        //    Maps to: molt.gno
        //    Pattern: minting alice.molt.gno on Gnosis → alice.moltbook.ip on Story
        address moltbookReg = factory.deployRegistrar(
            "moltbook.ip",
            "Moltbook IP Registry",
            "MIP"
        );
        console.log("moltbook.ip registrar:", moltbookReg);

        // 4. Transfer factory ownership to Safe
        factory.transferOwnership(safe);
        console.log("StoryRegistrarFactory ownership transferred to Safe");

        vm.stopBroadcast();
    }
}
