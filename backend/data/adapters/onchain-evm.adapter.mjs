export function mapWhaleAlertEvmEvents(rows = []) {
  return rows
    .filter((row) => {
      const chain = String(row?.blockchain || "").toLowerCase();
      if (!chain) return true;
      return !chain.includes("solana");
    })
    .map((row, index) => ({
      id: `whale-alert-evm-${row.id || index}`,
      chain: row.blockchain || "ethereum",
      txHash: row.hash || null,
      token: row.symbol,
      amount: Number(row.amount || 0),
      usdValue: Number(row.amount_usd || 0),
      fromLabel: row.from?.owner || row.from?.owner_type || row.from?.address || "Unknown",
      fromOwnerType: row.from?.owner_type || "",
      fromAddress: row.from?.address || "",
      toLabel: row.to?.owner || row.to?.owner_type || row.to?.address || "Unknown",
      toOwnerType: row.to?.owner_type || "",
      toAddress: row.to?.address || "",
      timestamp: row.timestamp ? new Date(Number(row.timestamp) * 1000).toISOString() : new Date().toISOString(),
      provider: "whale_alert",
      rawText: `${row.amount} ${String(row.symbol || "").toUpperCase()} transfer`,
    }));
}
