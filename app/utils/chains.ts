import { defineChain } from 'viem';

export const gnosis = defineChain({
  id: 100,
  name: 'Gnosis',
  nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_GNOSIS_RPC || 'https://rpc.gnosischain.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Gnosisscan', url: 'https://gnosisscan.io' },
  },
});

export const storyProtocol = defineChain({
  id: 1514,
  name: 'Story',
  nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://mainnet.storyrpc.io'],
    },
  },
  blockExplorers: {
    default: { name: 'StoryScan', url: 'https://www.storyscan.io' },
  },
});

// ─── Canonical addresses (same on all EVM chains) ───
export const ERC6551_REGISTRY = '0x000000006551c19487814612e58FE06813775758' as const;

// ─── Gnosis (chainId 100) ───
export const GHOST_REGISTRY = (process.env.NEXT_PUBLIC_GHOST_REGISTRY || '0x73F2d7f43B3aa98D434F53e921d3A41aa570bE13') as `0x${string}`;
export const NFTMAIL_SAFE = '0xb7e493e3d226f8fe722cc9916ff164b793af13f4' as `0x${string}`;

// ─── Story Protocol Mainnet core contracts ───
// Source: https://docs.story.foundation/developers/deployed-smart-contracts
export const STORY_IP_ASSET_REGISTRY = '0x77319B4031e6eF1250907aa00018B8B1c67a244b' as `0x${string}`;
export const STORY_LICENSE_REGISTRY  = '0x529a750E02d8E2f15649c13D69a465286a780e24' as `0x${string}`;
export const STORY_LICENSING_MODULE  = '0x04fbd8a2e56dd85CFD5500A4A4DfA955B9f1dE6f' as `0x${string}`;
export const STORY_PIL_TEMPLATE      = '0x2E896b0b2Fdb7457499B56AAaA4AE55BCB4Cd316' as `0x${string}`;
export const STORY_LICENSE_TOKEN     = '0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC' as `0x${string}`;
export const STORY_ROYALTY_MODULE    = '0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086' as `0x${string}`;
export const STORY_DEFAULT_LICENSE_TERMS_ID = 1; // Non-Commercial Social Remixing

// ─── Deployed GNO Registrars (Gnosis chainId 100) ───
export const GNS_REGISTRY         = '0xA505e447474bd1774977510e7a7C9459DA79c4b9' as `0x${string}`;
export const GNO_REGISTRAR_FACTORY = '0x4D4b486c5d3eFc719E8c3d7d232785290856f866' as `0x${string}`;
export const GNO_REGISTRARS = {
  agent:    '0x199A06c664F90b332bd8A3566e63c24AFe3Dd571' as `0x${string}`,
  openclaw: '0x8b019B455fE369Dd8Bab938e63ed93A17BaCfA94' as `0x${string}`,
  molt:     '0xD2C8D961e0BBb9C5324709C145f3dc8dd7615dcf' as `0x${string}`,
  picoclaw: '0x5a6d432234A0E39916B94283F74cA92508373450' as `0x${string}`,
  vault:    '0x53984F8B3a1D9993e163bb64ecbE03B9E7CE2BeB' as `0x${string}`,
  nftmail:  '0x831ddd71e7c33e16b674099129E6E379DA407fAF' as `0x${string}`,
} as const;

// ─── Deployed Story Registrars (Story L1 chainId 1514) ───
export const STORY_REGISTRAR_FACTORY = '0xc39DB7E1E326BD8D60983E4c359E4F41D308E05e' as `0x${string}`;
export const STORY_REGISTRARS = {
  creation: '0xB85c4Ad44DD2f7862a8eE26DdBEE8F508859dE06' as `0x${string}`,
  moltbook: '0x53347ca0330AAD59784e61f557b2e14cCB1806BE' as `0x${string}`,
} as const;

// ─── StorySubRegistrar: maps [name].creation.ip → same TBA (portable) ───
export const STORY_SUB_REGISTRAR = '0x3C1Aa0F0949E40cABbE4e14B1297DA50a4F6D7CA' as `0x${string}`;

// ─── BrainModule: Safe module that awakens agents for A2A email ───
export const BRAIN_MODULE = '0x291e8405096413407c3Ddd8850Fb101b446f5200' as `0x${string}`;
