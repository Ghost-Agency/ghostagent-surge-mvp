import { createPublicClient, http, formatEther, isAddress } from "viem";
import { gnosis } from "viem/chains";
import { NextResponse } from "next/server";

const client = createPublicClient({
  chain: gnosis,
  transport: http("https://rpc.gnosischain.com"),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const safeAddress = searchParams.get("safeAddress");

    if (!safeAddress) {
      return NextResponse.json({ error: "Missing safeAddress" }, { status: 400 });
    }

    if (!isAddress(safeAddress)) {
      return NextResponse.json({ error: "Invalid safeAddress" }, { status: 400 });
    }

    if (safeAddress.toLowerCase() === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "safeAddress cannot be the zero address" }, { status: 400 });
    }

    const balanceWei = await client.getBalance({
      address: safeAddress as `0x${string}`,
    });
    const balanceXdai = formatEther(balanceWei);

    return NextResponse.json({
      safeAddress,
      chainId: 100,
      balanceWei: balanceWei.toString(),
      balanceXdai,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
