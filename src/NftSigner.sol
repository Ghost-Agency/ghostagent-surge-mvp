// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title NftSigner
/// @notice ERC-1271 owner contract for a Gnosis Safe. Signature validity is
///         derived from the current holder of a specific ERC-721 token.
///         Transferring the NFT instantly transfers control of the Safe.
///
///         Supports two key-holder types:
///         - EOA  → standard ECDSA validation
///         - Contract (e.g. Privy AA wallet) → nested ERC-1271 check
contract NftSigner {
    bytes4 private constant _ERC1271_MAGIC = 0x1626ba7e;
    bytes4 private constant _ERC1271_INVALID = 0xffffffff;

    IERC721 public immutable keyToken;
    uint256 public immutable keyTokenId;

    constructor(address keyToken_, uint256 keyTokenId_) {
        keyToken = IERC721(keyToken_);
        keyTokenId = keyTokenId_;
    }

    /// @notice Returns the current address that controls this signer
    ///         (i.e. the current NFT holder).
    function keyHolder() public view returns (address) {
        return keyToken.ownerOf(keyTokenId);
    }

    /// @notice ERC-1271: validate a signature against the current NFT holder.
    /// @param hash   The hash that was signed (e.g. Safe tx hash).
    /// @param signature  The signature bytes.
    /// @return magicValue  `0x1626ba7e` if valid, `0xffffffff` otherwise.
    function isValidSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4 magicValue) {
        address holder = keyHolder();

        if (_isContract(holder)) {
            // Nested ERC-1271: holder is a contract wallet (Privy AA, etc.)
            try IERC1271(holder).isValidSignature(hash, signature) returns (bytes4 result) {
                return result == _ERC1271_MAGIC ? _ERC1271_MAGIC : _ERC1271_INVALID;
            } catch {
                return _ERC1271_INVALID;
            }
        }

        // EOA path: recover signer from ECDSA signature
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(hash, signature);
        if (err == ECDSA.RecoverError.NoError && recovered == holder) {
            return _ERC1271_MAGIC;
        }
        return _ERC1271_INVALID;
    }

    function _isContract(address account) private view returns (bool) {
        return account.code.length > 0;
    }
}

/// @dev Minimal ERC-1271 interface for nested contract-wallet validation.
interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4);
}
