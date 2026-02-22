'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createWalletClient, createPublicClient, custom, http, decodeEventLog } from 'viem';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { gnosis, GNO_REGISTRARS } from '../utils/chains';
import NamespaceRegistrarABI from '../abi/NamespaceRegistrar.json';

type MintStep = 'idle' | 'minting' | 'done' | 'error';
type MintMode = 'gasless' | 'wallet';

interface MintResult {
  name: string;
  email: string;
  tbaAddress: string;
  txHash: string;
  gasless?: boolean;
}

export function MintNFTMail() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [step, setStep] = useState<MintStep>('idle');
  const [result, setResult] = useState<MintResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [mintMode, setMintMode] = useState<MintMode>('gasless');

  const registrar = GNO_REGISTRARS.nftmail;
  const label = name1 && name2 ? `${name1}.${name2}` : '';
  const fullGno = label ? `${label}.nftmail.gno` : '';
  const fullEmail = label ? `${label}@nftmail.box` : '';

  const injectedWallet = wallets.find((w: any) => w?.walletClientType === 'injected');
  const anyWallet = wallets[0];

  // Gasless mint — treasury pays gas, user just needs a connected address
  const mintGasless = useCallback(async () => {
    if (!authenticated || wallets.length === 0) {
      setError('Connect your wallet first');
      return;
    }
    if (!name1 || name1.length < 2 || !name2 || name2.length < 2) {
      setError('Both name parts must be at least 2 characters');
      return;
    }

    const ownerAddress = (injectedWallet || anyWallet)?.address;
    if (!ownerAddress) {
      setError('No wallet address found');
      return;
    }

    setStep('minting');
    setError(null);

    try {
      const res = await fetch('/api/gasless-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, owner: ownerAddress }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gasless mint failed');
      }

      setResult({
        name: label,
        email: data.email,
        tbaAddress: data.tbaAddress || '',
        txHash: data.txHash,
        gasless: true,
      });
      setStep('done');
      setShowModal(true);
    } catch (err: any) {
      setError(err?.message || 'Gasless mint failed');
      setStep('error');
    }
  }, [authenticated, wallets, name1, name2, label, injectedWallet, anyWallet]);

  // Wallet mint — user pays gas with their own xDAI
  const mintWithWallet = useCallback(async () => {
    if (!authenticated || wallets.length === 0) {
      setError('Connect your wallet first');
      return;
    }
    if (!injectedWallet) {
      setError('Connect an external wallet (Rabby/MetaMask). Embedded wallets are not funded for gas.');
      return;
    }
    if (!name1 || name1.length < 2 || !name2 || name2.length < 2) {
      setError('Both name parts must be at least 2 characters');
      return;
    }

    setStep('minting');
    setError(null);

    try {
      const wallet = injectedWallet;
      await wallet.switchChain(gnosis.id);
      const provider = await wallet.getEthereumProvider();

      const walletClient = createWalletClient({
        chain: gnosis,
        transport: custom(provider),
        account: wallet.address as `0x${string}`,
      });

      const publicClient = createPublicClient({
        chain: gnosis,
        transport: http(),
      });

      const balanceWei = await publicClient.getBalance({
        address: wallet.address as `0x${string}`,
      });
      if (balanceWei === BigInt(0)) {
        throw new Error(`Wallet ${wallet.address} has 0 xDAI. Fund this wallet or connect a different wallet.`);
      }

      const hash = await walletClient.writeContract({
        address: registrar,
        abi: NamespaceRegistrarABI,
        functionName: 'mintSubname',
        args: [
          label,
          wallet.address as `0x${string}`,
          '0x',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let tbaAddress = '';
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: NamespaceRegistrarABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'TokenboundAccountCreated') {
            tbaAddress = (decoded.args as any).account;
          }
        } catch {}
      }

      setResult({
        name: label,
        email: fullEmail,
        tbaAddress,
        txHash: hash,
      });
      setStep('done');
      setShowModal(true);
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Minting failed');
      setStep('error');
    }
  }, [authenticated, wallets, name1, name2, registrar, fullEmail, label, injectedWallet]);

  const mint = mintMode === 'gasless' ? mintGasless : mintWithWallet;

  if (!authenticated) return null;

  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-semibold tracking-[0.18em] text-[var(--muted)]">CHOOSE YOUR NAME</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="text"
              value={name1}
              onChange={(e) => {
                setName1(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                setError(null);
              }}
              placeholder="e.g. alice"
              disabled={step === 'minting'}
              className="rounded-lg border border-[var(--border)] bg-black/40 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-[rgba(0,163,255,0.5)] disabled:opacity-50"
            />
            <input
              type="text"
              value={name2}
              onChange={(e) => {
                setName2(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                setError(null);
              }}
              placeholder="e.g. ops"
              disabled={step === 'minting'}
              className="rounded-lg border border-[var(--border)] bg-black/40 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-[rgba(0,163,255,0.5)] disabled:opacity-50"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-xs text-[var(--muted)]">
              {name1 || 'name1'}<span className="text-white/30">.</span>
              {name2 || 'name2'}<span className="text-white/30">.nftmail.gno</span>
            </div>
          </div>
          {label && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-[rgb(160,220,255)]">{fullGno} → {fullEmail}</p>
              <p className="text-[10px] text-[var(--muted)]">Self-contained — same TBA, zero dependency on creation.ip</p>
            </div>
          )}
        </div>

        {/* Mint mode toggle */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setMintMode('gasless')}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-wider transition ${
              mintMode === 'gasless'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-[var(--muted)] hover:text-white/60'
            }`}
          >
            FREE MINT
          </button>
          <button
            onClick={() => setMintMode('wallet')}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-wider transition ${
              mintMode === 'wallet'
                ? 'bg-[rgba(0,163,255,0.15)] text-[rgb(160,220,255)] border border-[rgba(0,163,255,0.35)]'
                : 'text-[var(--muted)] hover:text-white/60'
            }`}
          >
            PAY GAS
          </button>
        </div>
        {mintMode === 'gasless' && (
          <p className="text-center text-[10px] text-emerald-300/60">No xDAI needed — gas sponsored by NFTMail treasury</p>
        )}

        <button
          onClick={mint}
          disabled={!label || name1.length < 2 || name2.length < 2 || step === 'minting'}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            mintMode === 'gasless'
              ? 'border-emerald-500/35 bg-emerald-500/8 text-emerald-300 hover:bg-emerald-500/16 hover:shadow-[0_0_24px_rgba(16,185,129,0.12)]'
              : 'border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.08)] text-[rgb(160,220,255)] hover:bg-[rgba(0,163,255,0.16)] hover:shadow-[0_0_24px_rgba(0,163,255,0.12)]'
          }`}
        >
          {step === 'minting'
            ? 'Minting on Gnosis...'
            : step === 'done'
            ? `Minted — ${fullEmail}`
            : mintMode === 'gasless'
            ? 'Mint Free NFTMail Address'
            : 'Mint NFTMail Address'}
        </button>

        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>

      <AnimatePresence>
        {showModal && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
            >
              <div className="relative overflow-hidden bg-gradient-to-r from-[rgba(0,163,255,0.15)] to-emerald-500/15 px-6 py-5">
                <h3 className="text-lg font-bold text-white">NFTMail Minted{result.gasless ? ' (Free)' : ''}</h3>
                <p className="text-xs text-[var(--muted)]">{result.name} — self-contained identity{result.gasless ? ' · gas sponsored' : ''}</p>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">EMAIL ADDRESS</span>
                  <code className="text-sm font-bold text-emerald-300">{result.email}</code>
                </div>

                {result.tbaAddress && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">TBA</span>
                    <code className="break-all text-xs text-[rgb(160,220,255)]">{result.tbaAddress}</code>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-wider text-[var(--muted)]">TX</span>
                  <a
                    href={`https://gnosisscan.io/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[rgb(160,220,255)] hover:underline"
                  >
                    {result.txHash.slice(0, 14)}...{result.txHash.slice(-8)} ↗
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-[var(--border)] px-6 py-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg bg-[rgba(0,163,255,0.12)] px-4 py-2 text-xs font-semibold text-[rgb(160,220,255)] transition hover:bg-[rgba(0,163,255,0.2)]"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
