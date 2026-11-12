"use client";

import { useEffect, useState, useTransition } from "react";
import { saveHolding } from "@/app/actions/holdings";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { todayISO } from "@/lib/format";
import { Button, Input, Label, Modal, Select } from "@/components/ui";

type AccountOption = { id: number; name: string; currency: string };

export function AddHoldingModal({
  accounts,
  open,
  onClose,
}: {
  accounts: AccountOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState("USD");
  const [accountId, setAccountId] = useState<number | "">("");

  useEffect(() => {
    if (!open) return;
    setCurrency("USD");
    setAccountId("");
  }, [open]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveHolding(formData);
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add holding"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-holding-form" disabled={pending}>
            {pending ? "Saving…" : "Add holding"}
          </Button>
        </div>
      }
    >
      <form id="add-holding-form" action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ah-symbol">Symbol</Label>
            <Input
              id="ah-symbol"
              name="symbol"
              required
              placeholder="AAPL"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="ah-name">Name</Label>
            <Input
              id="ah-name"
              name="name"
              required
              placeholder="Apple Inc."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ah-type">Type</Label>
            <Select id="ah-type" name="assetType" defaultValue="stock">
              <option value="stock">Stock</option>
              <option value="etf">ETF</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ah-currency">Currency</Label>
            <Select
              id="ah-currency"
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ah-qty">Quantity</Label>
            <Input
              id="ah-qty"
              name="quantity"
              type="number"
              step="any"
              required
            />
          </div>
          <div>
            <Label htmlFor="ah-cost">Avg cost (per unit)</Label>
            <Input
              id="ah-cost"
              name="costBasis"
              type="number"
              step="0.01"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ah-date">Purchase date</Label>
            <Input
              id="ah-date"
              name="date"
              type="date"
              defaultValue={todayISO()}
              required
            />
          </div>
          <div>
            <Label htmlFor="ah-account">Linked account (optional)</Label>
            <Select
              id="ah-account"
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
        </div>
      </form>
    </Modal>
  );
}
