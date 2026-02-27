// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface ISafe {
    function nonce() external view returns (uint256);
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

interface IRegistrar {
    function mintSubname(
        string calldata label,
        address owner,
        bytes calldata storyData,
        bytes32 tbaSalt
    ) external returns (uint256 tokenId, bytes32 subnode, bytes32 ipaId, address tba);
    function nextTokenId() external view returns (uint256);
}

contract MintGhostagentMolt is Script {
    address constant SAFE = 0xb7e493e3d226f8fE722CC9916fF164B793af13F4;
    address constant MOLT_REGISTRAR = 0xD2C8D961e0BBb9C5324709C145f3dc8dd7615dcf;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address signer = vm.addr(pk);

        ISafe safe = ISafe(SAFE);
        IRegistrar registrar = IRegistrar(MOLT_REGISTRAR);

        console.log("Signer:", signer);
        console.log("Next token ID:", registrar.nextTokenId());

        // Encode mintSubname calldata
        bytes memory mintData = abi.encodeCall(
            registrar.mintSubname,
            ("ghostagent", SAFE, "", bytes32(0))
        );

        // Get Safe nonce and transaction hash
        uint256 safeNonce = safe.nonce();
        console.log("Safe nonce:", safeNonce);

        bytes32 txHash = safe.getTransactionHash(
            MOLT_REGISTRAR, // to
            0,              // value
            mintData,       // data
            0,              // operation (CALL)
            0,              // safeTxGas
            0,              // baseGas
            0,              // gasPrice
            address(0),     // gasToken
            address(0),     // refundReceiver
            safeNonce       // nonce
        );

        console.log("Safe tx hash:");
        console.logBytes32(txHash);

        // Sign the transaction hash with ECDSA
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, txHash);

        // Pack signature: r + s + v
        bytes memory signature = abi.encodePacked(r, s, v);

        console.log("Sending execTransaction...");

        vm.startBroadcast(pk);

        bool success = safe.execTransaction(
            MOLT_REGISTRAR,
            0,
            mintData,
            0,        // CALL
            0,
            0,
            0,
            address(0),
            address(0),
            signature
        );

        vm.stopBroadcast();

        require(success, "execTransaction failed");
        console.log("SUCCESS! ghostagent.molt.gno minted to Safe");
        console.log("Token ID:", registrar.nextTokenId() - 1);
    }
}
