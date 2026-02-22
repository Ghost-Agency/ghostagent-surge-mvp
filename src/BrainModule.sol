// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IGnosisSafe } from "./interfaces/IGnosisSafe.sol";

/// @title BrainModule
/// @notice Safe module that "awakens" an agent:
///   1. User installs Brain into their Safe via enableModule()
///   2. Agent calls awaken() to register itself as Awakened
///   3. CF email worker checks isAwakened() → routes A2A to Brain
///   4. Brain can execute txs from Safe (send A2A, sign, transact)
///
/// One-liner: "Attach agent = install Brain module into Safe →
///             Safe now owns Brain → agent starts receiving/sending A2A email."
contract BrainModule is Ownable {

    /// @notice Agent state
    enum AgentState { None, Awakened, Suspended }

    struct BrainInfo {
        address safe;
        address tba;
        AgentState state;
        uint256 awakenedAt;
        string agentName;
    }

    /// @notice agent name → BrainInfo
    mapping(string => BrainInfo) public brains;

    /// @notice safe address → agent name (reverse lookup)
    mapping(address => string) public safeToAgent;

    /// @notice tba address → agent name (reverse lookup)
    mapping(address => string) public tbaToAgent;

    /// @notice Total awakened agents
    uint256 public awakenedCount;

    event Awakened(
        string indexed agentName,
        address indexed safe,
        address indexed tba,
        uint256 timestamp
    );

    event Suspended(string indexed agentName, address indexed safe);
    event Resumed(string indexed agentName, address indexed safe);

    event BrainExecuted(
        string indexed agentName,
        address indexed safe,
        address indexed to,
        uint256 value,
        bytes data
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Awaken an agent — called after Brain is installed as Safe module
    /// @param agentName The agent name (e.g. "postmaster")
    /// @param safe The Safe address that has this Brain as a module
    /// @param tba The TBA address that owns the Safe
    function awaken(
        string calldata agentName,
        address safe,
        address tba
    ) external {
        require(bytes(agentName).length > 0, "Empty name");
        require(safe != address(0), "Invalid safe");
        require(tba != address(0), "Invalid tba");
        require(brains[agentName].state == AgentState.None, "Already awakened");

        // Verify this contract is actually a module on the Safe
        require(_isModuleEnabled(safe), "Brain not installed as module");

        brains[agentName] = BrainInfo({
            safe: safe,
            tba: tba,
            state: AgentState.Awakened,
            awakenedAt: block.timestamp,
            agentName: agentName
        });

        safeToAgent[safe] = agentName;
        tbaToAgent[tba] = agentName;
        awakenedCount++;

        emit Awakened(agentName, safe, tba, block.timestamp);
    }

    /// @notice Check if an agent is awakened (used by CF worker via eth_call)
    function isAwakened(string calldata agentName) external view returns (bool) {
        return brains[agentName].state == AgentState.Awakened;
    }

    /// @notice Get full brain info for an agent
    function getBrain(string calldata agentName) external view returns (
        address safe,
        address tba,
        AgentState state,
        uint256 awakenedAt
    ) {
        BrainInfo storage b = brains[agentName];
        return (b.safe, b.tba, b.state, b.awakenedAt);
    }

    /// @notice Check if agent is awakened by Safe address (reverse lookup)
    function isAwakenedBySafe(address safe) external view returns (bool, string memory) {
        string memory name = safeToAgent[safe];
        if (bytes(name).length == 0) return (false, "");
        return (brains[name].state == AgentState.Awakened, name);
    }

    /// @notice Check if agent is awakened by TBA address (reverse lookup)
    function isAwakenedByTba(address tba) external view returns (bool, string memory) {
        string memory name = tbaToAgent[tba];
        if (bytes(name).length == 0) return (false, "");
        return (brains[name].state == AgentState.Awakened, name);
    }

    /// @notice Execute a transaction from the Safe via Brain module
    /// @dev Only callable by the TBA (the Safe's owner) or contract owner
    function execute(
        string calldata agentName,
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bool success) {
        BrainInfo storage b = brains[agentName];
        require(b.state == AgentState.Awakened, "Not awakened");
        require(
            msg.sender == b.tba || msg.sender == owner(),
            "Only TBA or owner"
        );

        success = IGnosisSafe(b.safe).execTransactionFromModule(
            to,
            value,
            data,
            IGnosisSafe.Operation.Call
        );

        emit BrainExecuted(agentName, b.safe, to, value, data);
    }

    /// @notice Suspend an agent (owner only — emergency kill switch)
    function suspend(string calldata agentName) external onlyOwner {
        require(brains[agentName].state == AgentState.Awakened, "Not awakened");
        brains[agentName].state = AgentState.Suspended;
        awakenedCount--;
        emit Suspended(agentName, brains[agentName].safe);
    }

    /// @notice Resume a suspended agent (owner only)
    function resume(string calldata agentName) external onlyOwner {
        require(brains[agentName].state == AgentState.Suspended, "Not suspended");
        brains[agentName].state = AgentState.Awakened;
        awakenedCount++;
        emit Resumed(agentName, brains[agentName].safe);
    }

    /// @dev Check if this contract is an enabled module on the Safe
    function _isModuleEnabled(address safe) private view returns (bool) {
        // getModulesPaginated returns (modules[], next)
        // We check if this contract is in the first page of modules
        try IGnosisSafe(safe).getModulesPaginated(address(0x1), 10) returns (
            address[] memory modules,
            address
        ) {
            for (uint256 i = 0; i < modules.length; i++) {
                if (modules[i] == address(this)) return true;
            }
            return false;
        } catch {
            return false;
        }
    }
}
