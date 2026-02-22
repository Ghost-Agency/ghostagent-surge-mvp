// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title GovernanceTimelock
/// @notice 7-day timelock for governance actions on the NFTMail identity stack.
///         Any privileged operation (minter changes, module installs, parameter updates)
///         must be proposed and can only execute after the delay.
///         "If you don't hold the keys, you can't open the door."
contract GovernanceTimelock is Ownable {

    uint256 public constant TIMELOCK_DELAY = 7 days;

    struct Proposal {
        address target;
        uint256 value;
        bytes data;
        uint256 proposedAt;
        bool executed;
        bool cancelled;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    event ProposalCreated(uint256 indexed id, address indexed target, uint256 value, bytes data, uint256 executeAfter);
    event ProposalExecuted(uint256 indexed id, address indexed target, uint256 value, bytes data);
    event ProposalCancelled(uint256 indexed id);

    constructor() Ownable(msg.sender) {}

    /// @notice Propose a governance action (7-day delay before execution)
    function propose(address target, uint256 value, bytes calldata data) external onlyOwner returns (uint256 id) {
        id = proposalCount++;
        proposals[id] = Proposal({
            target: target,
            value: value,
            data: data,
            proposedAt: block.timestamp,
            executed: false,
            cancelled: false
        });
        emit ProposalCreated(id, target, value, data, block.timestamp + TIMELOCK_DELAY);
    }

    /// @notice Execute a proposal after the 7-day timelock
    function execute(uint256 id) external onlyOwner returns (bool success, bytes memory result) {
        Proposal storage p = proposals[id];
        require(!p.executed, "Already executed");
        require(!p.cancelled, "Cancelled");
        require(block.timestamp >= p.proposedAt + TIMELOCK_DELAY, "Timelock: too early");

        p.executed = true;
        (success, result) = p.target.call{value: p.value}(p.data);
        require(success, "Execution failed");

        emit ProposalExecuted(id, p.target, p.value, p.data);
    }

    /// @notice Cancel a pending proposal
    function cancel(uint256 id) external onlyOwner {
        Proposal storage p = proposals[id];
        require(!p.executed, "Already executed");
        require(!p.cancelled, "Already cancelled");
        p.cancelled = true;
        emit ProposalCancelled(id);
    }

    /// @notice Check if a proposal is ready to execute
    function isReady(uint256 id) external view returns (bool) {
        Proposal storage p = proposals[id];
        return !p.executed && !p.cancelled && block.timestamp >= p.proposedAt + TIMELOCK_DELAY;
    }

    receive() external payable {}
}
