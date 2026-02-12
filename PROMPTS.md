# PROMPTS

## Roadmap

### Milestone 1: Hackathon-ready MVP
- Goal:
- Success criteria:
- Demo flow:

### Milestone 2: Polish
- Goal:
- Success criteria:

### Milestone 3: Stretch goals
- Goal:
- Success criteria:

## Hackathon requirements

### Theme / problem statement
- 

### Submission checklist
- Repo link:
- Live demo link (Netlify):
- Short description:
- Team members:
- Technologies used:
-

### Judging criteria mapping
- Innovation:
- Technical difficulty:
- Design / UX:
- Impact:
- Presentation:

## Prompt log

### Prompts to reuse
- Inbound Agent Data mock JSON schema

```json
[
  {
    "id": "msg_001",
    "sender": "oracle.molt.gno",
    "recipient": "alice@nftmail.box",
    "subject": "Market Data: GNO/xDAI",
    "body_preview": "Current price trend analysis for Gnosis Chain...",
    "ipfs_hash": "QmXoyp...789",
    "status": "Verified",
    "timestamp": "2026-02-12T14:30:00Z"
  },
  {
    "id": "msg_002",
    "sender": "governance@gnosis.dao",
    "recipient": "alice@nftmail.box",
    "subject": "GIP-128 Voting Instruction",
    "body_preview": "Instruction to vote 'YES' on the upcoming protocol upgrade...",
    "ipfs_hash": "QmZk4v...456",
    "status": "Encrypted",
    "timestamp": "2026-02-12T15:45:00Z"
  }
]
```

- Mailbox: Reply as Agent modal + send flow

```text
Add a 'Reply as Agent' button to the message detail view in the Mailbox.
The UI: When clicked, open a sleek modal (pop-up) with a text area.
Context: The 'From' address should be locked as the user's active .gno identity (e.g., alice.molt.gno).
The 'Send' Action: When the user hits 'Send', show a loading animation that says 'Encrypting & Signing...'.
Success State: After 2 seconds, show a success toast: 'Response routed via nftmail.box. IPFS Receipt: Qm...'.
Visuals: Use an 'Electric Blue' glow for the button to match our 'Claw' theme.
```

- Vault: Agent Proof-of-Capital (AgentAuditCard) with Safe SDK balance audit

```text
Act as a Senior Frontend Engineer. Create a new component AgentAuditCard.tsx inside the /components folder.
Data Fetching: Use the @safe-global/api-kit and @safe-global/protocol-kit to fetch the native xDAI balance for a provided Gnosis Chain Safe address.
UI Design:
Title: 'Agent Proof-of-Capital'
Primary Stat: Large 'xDAI Balance' display with a glowing blue border.
Asset List: A scrollable list of 'IP Assets' (e.g., 'ghostagent.ip', 'openclaw.gno').
Badge: A 'Gnosis Pay Ready' green indicator if the balance is > 0.1 xDAI.
The 'Audit' Animation: When the component loads, show a 'Scanning Blockchain...' progress bar for 1.5 seconds using Framer Motion.
Integration: Drop this card into the 'Vault' tab of our main dashboard.

UX Note: Handle user notifications when an audit is complete.
- Option A (lightweight): Toast on audit completion.
- Option B (persistent): Append audit results into a persistent "Audit Log" list stored in localStorage (or later, persisted in a backend).
```

### Decisions
- 
