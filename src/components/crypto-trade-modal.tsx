"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { buyCrypto, sellCrypto } from "@/app/actions/crypto";
import { lookupCrypto, POPULAR_CRYPTO } from "@/lib/crypto-symbols";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { todayISO } from "@/lib/format";
import { Button, Input, Label, Modal, Select } from "@/components/ui";
import type { CryptoRow } from "@/components/crypto-list";

export type TradeMode = "buy" | "sell";

type AccountOption = { id: number; name: string; currency: string };

export function CryptoTradeModal({
  mode,
  holdings,
  accounts,
  presetHolding,
  open,
  onClose,
}: {
  mode: TradeMode;
  holdings: CryptoRow[];
  accounts: AccountOption[];
  presetHolding: CryptoRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [holdingId, setHoldingId] = useState<number | "">(
    presetHolding?.id ?? holdings[0]?.id ?? "",
  );
  const [symbol, setSymbol] = useState(presetHolding?.symbol ?? "");
  const [name, setName] = useState(presetHolding?.name ?? "");
  const [currency, setCurrency] = useState(
    presetHolding?.priceCurrency ?? presetHolding?.currency ?? "USD",
  );
  const [price, setPrice] = useState(
    presetHolding?.currentPrice != null
      ? String(presetHolding.currentPrice)
      : "",
  );
  const [accountId, setAccountId] = useState<number | "">(
    accounts[0]?.id ?? "",
  );

  const selectedHolding = useMemo(
    () => holdings.find((h) => h.id === holdingId) ?? null,
    [holdings, holdingId],
  );

  useEffect(() => {
    if (!open) return;

    if (mode === "sell") {
      const h = presetHolding ?? holdings[0] ?? null;
      setHoldingId(h?.id ?? "");
      setSymbol(h?.symbol ?? "");
      setName(h?.name ?? "");
      setCurrency(h?.priceCurrency ?? h?.currency ?? "USD");
      setPrice(h?.currentPrice != null ? String(h.currentPrice) : "");
    } else if (presetHolding) {
      setHoldingId(presetHolding.id);
      setSymbol(presetHolding.symbol);
      setName(presetHolding.name);
      setCurrency(
        presetHolding.priceCurrency ?? presetHolding.currency ?? "USD",
      );
      setPrice(
        presetHolding.currentPrice != null
          ? String(presetHolding.currentPrice)
          : "",
      );
    } else {
      setHoldingId("");
      setSymbol("");
      setName("");
      setCurrency("USD");
      setPrice("");
    }
    setAccountId(accounts[0]?.id ?? "");
  }, [open, mode, presetHolding, holdings, accounts]);

  function applySymbol(sym: string) {
    const upper = sym.trim().toUpperCase();
    setSymbol(upper);
    const known = lookupCrypto(upper);
    const existing = holdings.find((h) => h.symbol === upper);
    if (known) setName(known.name);
    else if (existing) setName(existing.name);
    if (existing) {
      setHoldingId(existing.id);
      setCurrency(existing.priceCurrency ?? existing.currency);
      if (existing.currentPrice != null) {
        setPrice(String(existing.currentPrice));
      }
    }
  }

  function onSellHoldingChange(id: number) {
    setHoldingId(id);
    const h = holdings.find((row) => row.id === id);
    if (!h) return;
    setSymbol(h.symbol);
    setName(h.name);
    setCurrency(h.priceCurrency ?? h.currency);
    setPrice(h.currentPrice != null ? String(h.currentPrice) : "");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (mode === "buy") {
        await buyCrypto(formData);
      } else {
        await sellCrypto(formData);
      }
      onClose();
    });
  }

  const title = mode === "buy" ? "Buy crypto" : "Sell crypto";
  const canSell = holdings.length > 0;
  const noAccounts = accounts.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="crypto-trade-form"
            variant="primary"
            disabled={
              pending ||
              noAccounts ||
              (mode === "sell" && (!canSell || !holdingId))
            }
          >
            {pending ? "Saving…" : mode === "buy" ? "Buy" : "Sell"}
          </Button>
        </div>
      }
    >
      {noAccounts ? (
        <p className="text-sm text-loss">
          Add an account first so trades can be logged in your transaction
          history.
        </p>
      ) : mode === "sell" && !canSell ? (
        <p className="text-sm text-muted-foreground">
          No holdings to sell. Buy crypto first.
        </p>
      ) : (
        <form id="crypto-trade-form" action={handleSubmit} className="space-y-4">
          {mode === "sell" && holdingId !== "" && (
            <input type="hidden" name="id" value={holdingId} />
          )}

          {mode === "buy" ? (
            <>
              <div>
                <Label htmlFor="trade-symbol">Symbol</Label>
                <Input
                  id="trade-symbol"
                  name="symbol"
                  value={symbol}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase();
                    setSymbol(next);
                    const known = lookupCrypto(next);
                    if (known) setName(known.name);
                    const existing = holdings.find((h) => h.symbol === next);
                    if (existing?.currentPrice != null) {
                      setPrice(String(existing.currentPrice));
                      setCurrency(
                        existing.priceCurrency ?? existing.currency,
                      );
                    }
                  }}
                  placeholder="e.g. BTC"
                  autoComplete="off"
                  required
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {POPULAR_CRYPTO.map((c) => (
                    <button
                      key={c.symbol}
                      type="button"
                      onClick={() => applySymbol(c.symbol)}
                      className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-foreground"
                    >
                      {c.symbol}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="trade-name">Name</Label>
                <Input
                  id="trade-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Bitcoin"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="trade-holding">Holding</Label>
              <Select
                id="trade-holding"
                value={holdingId === "" ? "" : String(holdingId)}
                onChange={(e) => onSellHoldingChange(Number(e.target.value))}
                required
              >
                {holdings.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.symbol} — {h.quantity} owned
                  </option>
                ))}
              </Select>
              {selectedHolding && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Max sell: {selectedHolding.quantity} {selectedHolding.symbol}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="trade-qty">Quantity</Label>
              <Input
                id="trade-qty"
                name="quantity"
                type="number"
                step="any"
                min="0"
                max={
                  mode === "sell" && selectedHolding
                    ? selectedHolding.quantity
                    : undefined
                }
                placeholder="0.1"
                required
              />
            </div>
            <div>
              <Label htmlFor="trade-price">Price per unit</Label>
              <Input
                id="trade-price"
                name="price"
                type="number"
                step="any"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="trade-currency">Currency</Label>
              <Select
                id="trade-currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="trade-date">Date</Label>
              <Input
                id="trade-date"
                name="date"
                type="date"
                defaultValue={todayISO()}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="trade-account">Log under account</Label>
            <Select
              id="trade-account"
              name="accountId"
              value={accountId === "" ? "" : String(accountId)}
              onChange={(e) =>
                setAccountId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Logged as a transaction for history — account balance is not
              changed.
            </p>
          </div>
        </form>
      )}
    </Modal>
  );
}
