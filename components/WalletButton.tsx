"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button className="nm-btn" onClick={() => disconnect()} title={address}>
        <span className="inline-block h-2 w-2 bg-success" />
        {address?.slice(0, 6)}…{address?.slice(-4)}
        <span className="text-muted">✕</span>
      </button>
    );
  }
  return (
    <button
      className="nm-btn-accent nm-btn"
      onClick={() => connect({ connector: connectors[0] })}
    >
      Connect Wallet
    </button>
  );
}
