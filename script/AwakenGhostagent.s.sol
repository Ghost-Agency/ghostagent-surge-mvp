// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface ISafe {
    function nonce() external view returns (uint256);
    function isModuleEnabled(address module) external view returns (bool);
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes memory signatures
    ) external payable returns (bool success);
}

interface IBrainModule {
    function awaken(string calldata agentName, address safe, address tba) external;
    function isAwakened(string calldata agentName) external view returns (bool);
}

contract AwakenGhostagent is Script {
    address constant SAFE = 0xb7e493e3d226f8fE722CC9916fF164B793af13F4;
    address constant BRAIN_MODULE = 0x291e8405096413407c3Ddd8850Fb101b446f5200;
    address constant TBA = 0xcEc7C380c635E68639636DD2F7aa86FbA920A4f6;

    function _execSafe(uint256 pk, address to, bytes memory data) internal {
        ISafe safe = ISafe(SAFE);
        uint256 safeNonce = safe.nonce();
        bytes32 txHash = safe.getTransactionHash(
            to, 0, data, 0, 0, 0, 0, address(0), address(0), safeNonce
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, txHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.broadcast(pk);
        bool success = safe.execTransaction(
            to, 0, data, 0, 0, 0, 0, address(0), address(0), sig
        );
        require(success, "execTransaction failed");
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address signer = vm.addr(pk);
        ISafe safe = ISafe(SAFE);
        IBrainModule brain = IBrainModule(BRAIN_MODULE);

        console.log("Signer:", signer);
        console.log("Safe nonce:", safe.nonce());

        // Step 1: enableModule(BrainModule) on the Safe
        bool alreadyEnabled = safe.isModuleEnabled(BRAIN_MODULE);
        if (alreadyEnabled) {
            console.log("BrainModule already enabled on Safe, skipping step 1");
        } else {
            console.log("Step 1: Enabling BrainModule on Safe...");
            bytes memory enableData = abi.encodeWithSignature(
                "enableModule(address)", BRAIN_MODULE
            );
            _execSafe(pk, SAFE, enableData);
            console.log("BrainModule enabled!");

            // Verify
            require(safe.isModuleEnabled(BRAIN_MODULE), "enableModule failed");
        }

        // Step 2: awaken("ghostagent", safe, tba)
        bool alreadyAwake = brain.isAwakened("ghostagent");
        if (alreadyAwake) {
            console.log("ghostagent already awakened, skipping step 2");
        } else {
            console.log("Step 2: Awakening ghostagent...");
            vm.broadcast(pk);
            brain.awaken("ghostagent", SAFE, TBA);
            console.log("ghostagent AWAKENED!");
        }

        // Final verification
        require(brain.isAwakened("ghostagent"), "awaken verification failed");
        console.log("=== ghostagent.molt.gno is LIVE ===");
        console.log("Safe:", SAFE);
        console.log("TBA:", TBA);
        console.log("BrainModule:", BRAIN_MODULE);
    }
}
