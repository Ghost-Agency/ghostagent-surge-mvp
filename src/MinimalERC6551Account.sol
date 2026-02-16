// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./interfaces/IERC6551Account.sol";

contract MinimalERC6551Account is ERC165, IERC6551Account {
    receive() external payable {}
    
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        // Return static values - registry only cares that this doesn't revert
        return (100, address(this), 0);
    }
    
    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        return IERC6551Account.isValidSigner.selector;
    }
    
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC6551Account).interfaceId || super.supportsInterface(interfaceId);
    }
}
