import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import { formatEther } from "ethers";
import { NextResponse } from "next/server";

const GNOSIS_CHAIN_ID = BigInt(100);
const GNOSIS_RPC_URL = "https://rpc.gnosischain.com";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const safeAddress = searchParams.get("safeAddress");

    if (!safeAddress) {
      return NextResponse.json({ error: "Missing safeAddress" }, { status: 400 });
    }

    const apiKit = new SafeApiKit({ chainId: GNOSIS_CHAIN_ID });
    const safeInfo = await apiKit.getSafeInfo(safeAddress);

    const protocolKit = await Safe.init({
      provider: GNOSIS_RPC_URL,
      safeAddress,
    });

    const balanceWei = await protocolKit.getBalance();
    const balanceXdai = formatEther(balanceWei);

    return NextResponse.json({
      safeAddress,
      chainId: Number(GNOSIS_CHAIN_ID),
      threshold: safeInfo.threshold,
      owners: safeInfo.owners,
      balanceWei: balanceWei.toString(),
      balanceXdai,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
