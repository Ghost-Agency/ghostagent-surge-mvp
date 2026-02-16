// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Create2.sol";
import "./ERC6551BytecodeLib.sol";

library ERC6551AccountLib {
    function computeAddress(
        address registry,
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) internal pure returns (address) {
        bytes32 bytecodeHash = keccak256(
            ERC6551BytecodeLib.getCreationCode(implementation, salt, chainId, tokenContract, tokenId)
        );

        return Create2.computeAddress(salt, bytecodeHash, registry);
    }

    function token() internal view returns (uint256, address, uint256) {
        bytes memory encodedData = new bytes(0x60);

        assembly {
            extcodecopy(address(), add(encodedData, 0x20), 0x4d, 0x60)
        }

        return abi.decode(encodedData, (uint256, address, uint256));
    }
}
