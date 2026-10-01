"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { transferFunds, updateTransfer } from "@/app/actions/accounts";
import type { AccountRow } from "@/components/account-list";
import { Button, Input, Label, Modal, Select } from "@/components/ui";
import type { TransferHistoryRow } from "@/lib/transfers";
import { formatMoney, todayISO } from "@/lib/format";

export function AccountTransferModal({
  accounts,
  transfer,
  open,
  onClose,
}: {
  accounts: AccountRow[];
  transfer?: TransferHistoryRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const isEditing = transfer != null;
  const [pending, startTransition] = useTransition();
  const [fromId, setFromId] = useState<number | "">(accounts[0]?.id ?? "");
  const [toId, setToId] = useState<number | "">(accounts[1]?.id ?? "");
  const [sentAmount, setSentAmount] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fromAccount = useMemo(
    () => accounts.find((a) => a.id === fromId) ?? null,
    [accounts, fromId],
  );
  const toAccount = useMemo(
    () => accounts.find((a) => a.id === toId) ?? null,
    [accounts, toId],
  );

  const sameCurrency =
    !!fromAccount &&
    !!toAccount &&
    fromAccount.currency === toAccount.currency;

  useEffect(() => {
    if (!open) return;
    if (transfer) {
      setFromId(transfer.fromAccountId);
      setToId(transfer.toAccountId);
      setSentAmount(String(transfer.sentAmount));
      setReceivedAmount(String(transfer.receivedAmount));
      setDate(transfer.date);
      setNote(transfer.note ?? "");
    } else {
      setFromId(accounts[0]?.id ?? "");
      setToId(accounts[1]?.id ?? accounts[0]?.id ?? "");
      setSentAmount("");
      setReceivedAmount("");
      setDate(todayISO());
      setNote("");
    }
    setError(null);
  }, [open, accounts, transfer]);

  function handleSubmit(formData: FormData) {
    setError(null);
    if (sameCurrency) {
      formData.set("receivedAmount", String(formData.get("sentAmount") ?? ""));
    }
    startTransition(async () => {
      try {
        if (isEditing && transfer) {
          formData.set("id", String(transfer.id));
          await updateTransfer(formData);
        } else {
          await transferFunds(formData);
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transfer failed");
      }
    });
  }

  const effectiveReceived = sameCurrency ? sentAmount : receivedAmount;
  const canSubmit =
    fromId !== "" &&
    toId !== "" &&
    fromId !== toId &&
    Number(sentAmount) > 0 &&
    Number(effectiveReceived) > 0 &&
    !pending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          {isEditing ? "Edit transfer" : "Transfer funds"}
        </span>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="account-transfer-form"
            disabled={!canSubmit}
          >
            {pending
              ? isEditing
                ? "Saving…"
                : "Transferring…"
              : isEditing
                ? "Save changes"
                : "Transfer"}
          </Button>
        </div>
      }
    >
      {accounts.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Add at least two accounts before transferring funds.
        </p>
      ) : (
        <form
          id="account-transfer-form"
          action={handleSubmit}
          className="space-y-4"
        >
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {isEditing
              ? "Updating a transfer adjusts account balances to match the corrected amounts."
              : "Balances update immediately. Transfers are not logged as expenses or income."}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="transfer-from">From</Label>
              <Select
                id="transfer-from"
                name="fromAccountId"
                value={fromId === "" ? "" : String(fromId)}
                onChange={(e) => {
                  const next = e.target.value ? Number(e.target.value) : "";
                  setFromId(next);
                  if (next !== "" && next === toId) {
                    const other = accounts.find((a) => a.id !== next);
                    setToId(other?.id ?? "");
                  }
                }}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatMoney(a.balance, a.currency)})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="transfer-to">To</Label>
              <Select
                id="transfer-to"
                name="toAccountId"
                value={toId === "" ? "" : String(toId)}
                onChange={(e) => {
                  const next = e.target.value ? Number(e.target.value) : "";
                  setToId(next);
                  if (next !== "" && next === fromId) {
                    const other = accounts.find((a) => a.id !== next);
                    setFromId(other?.id ?? "");
                  }
                }}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === fromId}>
                    {a.name} ({formatMoney(a.balance, a.currency)})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {sameCurrency ? (
            <div>
              <Label htmlFor="transfer-sent">
                Amount
                {fromAccount ? ` (${fromAccount.currency})` : ""}
              </Label>
              <Input
                id="transfer-sent"
                name="sentAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={sentAmount}
                onChange={(e) => setSentAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="transfer-sent">
                  Sent amount
                  {fromAccount ? ` (${fromAccount.currency})` : ""}
                </Label>
                <Input
                  id="transfer-sent"
                  name="sentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={sentAmount}
                  onChange={(e) => setSentAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="transfer-received">
                  Received amount
                  {toAccount ? ` (${toAccount.currency})` : ""}
                </Label>
                <Input
                  id="transfer-received"
                  name="receivedAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Different currencies — enter both amounts using your bank
                  rate.
                </p>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="transfer-date">Date</Label>
            <Input
              id="transfer-date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="transfer-note">Note (optional)</Label>
            <Input
              id="transfer-note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Move salary to savings"
            />
          </div>

          {error && <p className="text-sm text-loss">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
