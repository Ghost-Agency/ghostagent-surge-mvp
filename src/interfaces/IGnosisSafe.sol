// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Minimal Gnosis Safe interface for owner management
interface IGnosisSafe {
    enum Operation {
        Call,
        DelegateCall
    }

    function swapOwner(
        address prevOwner,
        address oldOwner,
        address newOwner
    ) external;

    function getOwners() external view returns (address[] memory);

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Operation operation
    ) external returns (bool success);

    function getModulesPaginated(
        address start,
        uint256 pageSize
    ) external view returns (address[] memory array, address next);

    function enableModule(address module) external;
}
