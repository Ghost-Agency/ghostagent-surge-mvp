// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Namehash {
    function labelhash(string memory label) internal pure returns (bytes32) {
        return keccak256(bytes(label));
    }

    function namehash(string memory name) internal pure returns (bytes32 node) {
        node = bytes32(0);
        bytes memory s = bytes(name);
        uint256 len = s.length;
        if (len == 0) return node;

        uint256 last = len;
        for (uint256 i = len; i > 0; i--) {
            if (s[i - 1] == ".") {
                uint256 labelLen = last - i;
                bytes32 lh = keccak256(_slice(s, i, labelLen));
                node = keccak256(abi.encodePacked(node, lh));
                last = i - 1;
            }
        }

        bytes32 first = keccak256(_slice(s, 0, last));
        node = keccak256(abi.encodePacked(node, first));
    }

    function _slice(bytes memory data, uint256 start, uint256 len) private pure returns (bytes memory out) {
        out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = data[start + i];
        }
    }
}
