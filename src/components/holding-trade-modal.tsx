"use client";

import { useEffect, useState, useTransition } from "react";
import { addHoldingTrade } from "@/app/actions/holding-trades";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { todayISO } from "@/lib/format";
import { Button, Input, Label, Modal, Select } from "@/components/ui";
import type { HoldingWithMetrics } from "@/lib/portfolio";

type AccountOption = { id: number; name: string; currency: string };

export function HoldingTradeModal({
  holding,
  accounts,
  open,
  onClose,
}: {
  holding: HoldingWithMetrics;
  accounts: AccountOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(
    holding.currentPrice != null ? String(holding.currentPrice) : "",
  );
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState(holding.currency);
  const [accountId, setAccountId] = useState<number | "">(
    holding.accountId ?? accounts[0]?.id ?? "",
  );

  useEffect(() => {
    if (!open) return;
    setQuantity("");
    setUnitPrice(
      holding.currentPrice != null ? String(holding.currentPrice) : "",
    );
    setTotalAmount("");
    setCurrency(holding.currency);
    setAccountId(holding.accountId ?? accounts[0]?.id ?? "");
  }, [open, holding, accounts]);

  useEffect(() => {
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (qty > 0 && price > 0) {
      setTotalAmount((qty * price).toFixed(2));
    }
  }, [quantity, unitPrice]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await addHoldingTrade(formData);
      onClose();
    });
  }

  const noAccounts = accounts.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record buy — ${holding.symbol}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="holding-trade-form"
            disabled={pending || noAccounts}
          >
            {pending ? "Saving…" : "Record buy"}
          </Button>
        </div>
      }
    >
      {noAccounts ? (
        <p className="text-sm text-loss">
          Add an account first to link this trade.
        </p>
      ) : (
        <form id="holding-trade-form" action={handleSubmit} className="space-y-4">
          <input type="hidden" name="holdingId" value={holding.id} />
          <input type="hidden" name="side" value="buy" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ht-qty">Quantity</Label>
              <Input
                id="ht-qty"
                name="quantity"
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                required
              />
            </div>
            <div>
              <Label htmlFor="ht-unit">Unit price</Label>
              <Input
                id="ht-unit"
                name="unitPrice"
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ht-total">Total (fees incl.)</Label>
            <Input
              id="ht-total"
              name="totalAmount"
              type="number"
              step="0.01"
              min="0"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ht-currency">Currency</Label>
              <Select
                id="ht-currency"
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
              <Label htmlFor="ht-date">Date</Label>
              <Input
                id="ht-date"
                name="date"
                type="date"
                defaultValue={todayISO()}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ht-account">Account</Label>
            <Select
              id="ht-account"
              name="accountId"
              value={accountId === "" ? "" : String(accountId)}
              onChange={(e) =>
                setAccountId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
          </div>
        </form>
      )}
    </Modal>
  );
}
