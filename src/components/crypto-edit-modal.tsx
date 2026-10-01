"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteCryptoHolding,
  saveCryptoHolding,
} from "@/app/actions/crypto";
import { lookupCrypto, POPULAR_CRYPTO } from "@/lib/crypto-symbols";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { Button, Input, Label, Modal, Select } from "@/components/ui";
import type { CryptoRow } from "@/components/crypto-list";

export function CryptoEditModal({
  holding,
  open,
  onClose,
}: {
  holding: CryptoRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [symbol, setSymbol] = useState(holding?.symbol ?? "");
  const [name, setName] = useState(holding?.name ?? "");
  const [currency, setCurrency] = useState(holding?.currency ?? "USD");

  useEffect(() => {
    if (open) {
      setSymbol(holding?.symbol ?? "");
      setName(holding?.name ?? "");
      setCurrency(holding?.currency ?? "USD");
    }
  }, [holding, open]);

  const isEditing = !!holding;

  function applySymbol(sym: string) {
    const upper = sym.trim().toUpperCase();
    setSymbol(upper);
    const known = lookupCrypto(upper);
    if (known) setName(known.name);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveCryptoHolding(formData);
      onClose();
    });
  }

  function handleDelete(formData: FormData) {
    if (!confirm("Delete this crypto holding?")) return;
    startTransition(async () => {
      await deleteCryptoHolding(formData);
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit crypto" : "Add crypto"}
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-crypto-form"
              variant="primary"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
          {isEditing && holding.updatedAt && (
            <>
              <form action={handleDelete}>
                <input type="hidden" name="id" value={holding.id} />
                <button
                  type="submit"
                  disabled={pending}
                  className="text-xs font-medium text-loss/80 transition hover:text-loss disabled:opacity-50"
                >
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                  Delete holding
                </button>
              </form>
              <p className="text-[10px] text-muted-foreground">
                Last updated:{" "}
                {new Date(holding.updatedAt).toLocaleString()}
              </p>
            </>
          )}
        </div>
      }
    >
      <form id="edit-crypto-form" action={handleSubmit} className="space-y-4">
        {isEditing && <input type="hidden" name="id" value={holding.id} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="crypto-symbol">Symbol</Label>
            <Input
              id="crypto-symbol"
              name="symbol"
              value={symbol}
              onChange={(e) => {
                const next = e.target.value.toUpperCase();
                setSymbol(next);
                if (!isEditing) {
                  const known = lookupCrypto(next);
                  if (known) setName(known.name);
                }
              }}
              placeholder="Any ticker, e.g. XMR"
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
        </div>

        <div>
          <Label htmlFor="crypto-name">Name</Label>
          <Input
            id="crypto-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Monero"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="crypto-quantity">Quantity</Label>
            <Input
              id="crypto-quantity"
              name="quantity"
              type="number"
              step="any"
              defaultValue={holding?.quantity ?? ""}
              placeholder="0.5"
              required
            />
          </div>
          <div>
            <Label htmlFor="crypto-currency">Quote currency</Label>
            <Select
              id="crypto-currency"
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
        </div>

        <div>
          <Label htmlFor="crypto-cost">Avg. cost per unit (optional)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {currency}
            </span>
            <Input
              id="crypto-cost"
              name="costBasis"
              type="number"
              step="any"
              defaultValue={holding?.costBasis ?? ""}
              placeholder="Purchase price per coin"
              className="pl-12"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
