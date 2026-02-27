/// API Route: Cross-Chain Safe Deployment
/// POST /api/cross-chain-safe
///
/// Actions:
///   - predict:  Predict Safe address on Story L1 (no gas needed)
///   - deploy:   Deploy Safe to Story L1 with same address as Gnosis
///   - status:   Check if Safe is already deployed on Story L1
///   - registerIP: Register an IP Asset via the Safe on Story L1

import { NextRequest, NextResponse } from 'next/server';
import {
  readGnosisSafeConfig,
  predictSafeAddress,
  findSaltNonce,
  deploySafeToStory,
  isSafeDeployedOnStory,
  registerIPAssetViaSafe,
  type SafeConfig,
} from '../../lib/cross-chain-safe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action?: string;
      safeAddress?: string;
      tokenContract?: string;
      tokenId?: string | number;
    };
    const { action, safeAddress, tokenContract, tokenId } = body;

    if (!safeAddress) {
      return NextResponse.json({ error: 'Missing safeAddress' }, { status: 400 });
    }

    const safe = safeAddress as `0x${string}`;

    // --- Predict: compute Story L1 address without deploying ---
    if (action === 'predict') {
      const config = await readGnosisSafeConfig(safe);
      const saltNonce = await findSaltNonce(safe, config.owners, config.threshold);
      const predicted = await predictSafeAddress(config.owners, config.threshold, saltNonce, 1514);
      const alreadyDeployed = await isSafeDeployedOnStory(predicted);

      return NextResponse.json({
        gnosisSafeAddress: safe,
        storyPredictedAddress: predicted,
        matched: predicted.toLowerCase() === safeAddress.toLowerCase(),
        alreadyDeployed,
        owners: config.owners,
        threshold: config.threshold,
        saltNonce: saltNonce.toString(),
      });
    }

    // --- Status: check if Safe exists on Story L1 ---
    if (action === 'status') {
      const deployed = await isSafeDeployedOnStory(safe);
      return NextResponse.json({
        safeAddress: safe,
        deployedOnStory: deployed,
        chain: 'Story L1 (1514)',
      });
    }

    // --- Deploy: deploy Safe to Story L1 ---
    if (action === 'deploy') {
      const result = await deploySafeToStory(safe);
      return NextResponse.json({
        ...result,
        chain: 'Story L1 (1514)',
        explorer: `https://www.storyscan.io/address/${result.storyDeployedAddress}`,
      });
    }

    // --- Register IP Asset via Safe ---
    if (action === 'registerIP') {
      if (!tokenContract || tokenId === undefined) {
        return NextResponse.json({ error: 'Missing tokenContract or tokenId' }, { status: 400 });
      }

      // Verify Safe is deployed on Story first
      const deployed = await isSafeDeployedOnStory(safe);
      if (!deployed) {
        return NextResponse.json({
          error: 'Safe not deployed on Story L1. Call deploy first.',
        }, { status: 400 });
      }

      const result = await registerIPAssetViaSafe(
        safe,
        tokenContract as `0x${string}`,
        BigInt(tokenId),
      );

      return NextResponse.json({
        ...result,
        safeAddress: safe,
        tokenContract,
        tokenId,
        chain: 'Story L1 (1514)',
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Cross-chain Safe error:', err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
