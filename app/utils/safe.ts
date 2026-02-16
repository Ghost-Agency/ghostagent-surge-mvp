import { ethers } from 'ethers';
import Safe from '@safe-global/safe-core-sdk';
import { EthersAdapter } from '@safe-global/safe-ethers-lib';
import type { SafeAccountConfig } from '@safe-global/safe-core-sdk-types';

const SAFE_FACTORY = process.env.NEXT_PUBLIC_SAFE_FACTORY!;

export async function deploySafe(owner: string, provider: ethers.Provider) {
  const signer = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer
  });

  const safeFactory = await Safe.create({
    ethAdapter,
    predictedSafe: {
      safeAccountConfig: {
        owners: [owner],
        threshold: 1
      }
    }
  });

  const safeAddress = await safeFactory.getAddress();
  return safeAddress;
}
