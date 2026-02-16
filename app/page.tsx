"use client";

import { ConnectButton } from './components/ConnectButton';
import { MintButton } from './components/MintButton';
import { NamespaceSelect } from './components/NamespaceSelect';
import { usePrivy } from '@privy-io/react-auth';

export default function Home() {
  const { authenticated } = usePrivy();

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(0,163,255,0.16),transparent_45%),radial-gradient(900px_circle_at_90%_10%,rgba(124,77,255,0.14),transparent_40%),linear-gradient(180deg,var(--background),#03040a)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-4 py-6 md:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-xs font-semibold tracking-[0.18em] text-[rgb(160,220,255)]">
            GHOSTAGENT.NINJA
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Non-custodial agent identity
          </h1>
          <p className="max-w-md text-sm text-[var(--muted)]">
            Mint your agent NFT to create a persistent identity vault on Gnosis Chain.
            Your NFT is the key — transfer it to transfer control.
          </p>
        </div>

        <div className="flex w-full max-w-2xl flex-col gap-6">
          <ConnectButton />
          {authenticated && (
            <>
              <NamespaceSelect />
              <MintButton />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
