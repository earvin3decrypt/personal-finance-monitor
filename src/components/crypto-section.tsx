"use client";

import { useState } from "react";
import { Button, OfflineBanner } from "@/components/ui";
import { CryptoList, type CryptoRow } from "@/components/crypto-list";
import { CryptoEditModal } from "@/components/crypto-edit-modal";
import {
  CryptoTradeModal,
  type TradeMode,
} from "@/components/crypto-trade-modal";

type AccountOption = { id: number; name: string; currency: string };

export function CryptoSection({
  holdings,
  accounts,
  baseCurrency,
  fxStale,
  pricesStale,
}: {
  holdings: CryptoRow[];
  accounts: AccountOption[];
  baseCurrency: string;
  fxStale?: boolean;
  pricesStale?: boolean;
}) {
  const [editing, setEditing] = useState<CryptoRow | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [tradeMode, setTradeMode] = useState<TradeMode | null>(null);
  const [tradePreset, setTradePreset] = useState<CryptoRow | null>(null);

  function openTrade(mode: TradeMode, holding: CryptoRow | null = null) {
    setTradePreset(holding);
    setTradeMode(mode);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => openTrade("buy")}
        >
          Buy
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => openTrade("sell")}
          disabled={holdings.length === 0}
        >
          Sell
        </Button>
        <Button type="button" onClick={() => setIsAdding(true)}>
          Add crypto
        </Button>
      </div>

      <OfflineBanner fxStale={fxStale} pricesStale={pricesStale} />

      <div className="mt-6">
        <CryptoList
          holdings={holdings}
          baseCurrency={baseCurrency}
          onEdit={setEditing}
          onBuy={(h) => openTrade("buy", h)}
          onSell={(h) => openTrade("sell", h)}
        />
      </div>

      <CryptoEditModal
        holding={editing}
        open={editing !== null || isAdding}
        onClose={() => {
          setEditing(null);
          setIsAdding(false);
        }}
      />

      {tradeMode && (
        <CryptoTradeModal
          mode={tradeMode}
          holdings={holdings}
          accounts={accounts}
          presetHolding={tradePreset}
          open={tradeMode !== null}
          onClose={() => {
            setTradeMode(null);
            setTradePreset(null);
          }}
        />
      )}
    </>
  );
}
