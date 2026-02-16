// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./ERC6551Account.sol";

contract StandardERC6551Account is ERC6551Account {
    function _isValidSigner(address signer, bytes memory) internal view override returns (bool) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) return false;
        return signer == IERC721(tokenContract).ownerOf(tokenId);
    }

    function _isValidSignature(bytes32, bytes calldata) internal view override returns (bool) {
        return false;
    }
}
