'use client';

import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

export function LinkButton() {
  const { authenticated } = usePrivy();

  if (!authenticated) return null;

  return (
    <Link
      href="/dashboard"
      className="group relative inline-flex items-center justify-center gap-2.5 rounded-xl border border-[rgba(0,163,255,0.35)] bg-[rgba(0,163,255,0.08)] px-6 py-3 text-sm font-semibold text-[rgb(160,220,255)] transition-all hover:bg-[rgba(0,163,255,0.16)] hover:shadow-[0_0_24px_rgba(0,163,255,0.15)]"
    >
      <svg
        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
      Enter Dashboard
      <svg
        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    </Link>
  );
}
