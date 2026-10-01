"use client";

import { useState } from "react";
import { Button, OfflineBanner } from "@/components/ui";
import { AccountList, type AccountRow } from "@/components/account-list";
import { AccountEditModal } from "@/components/account-edit-modal";
import { AccountTransferModal } from "@/components/account-transfer-modal";
import { AccountTransferHistory } from "@/components/account-transfer-history";
import type { TransferHistoryRow } from "@/lib/transfers";

export function AccountsSection({
  accounts,
  transfers,
  baseCurrency,
  fxStale,
}: {
  accounts: AccountRow[];
  transfers: TransferHistoryRow[];
  baseCurrency: string;
  fxStale?: boolean;
}) {
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [editingTransfer, setEditingTransfer] =
    useState<TransferHistoryRow | null>(null);
  const [addDefaultType, setAddDefaultType] = useState<
    "checking" | "savings" | "cash"
  >("checking");

  function openAddAccount(type: "checking" | "savings" | "cash" = "checking") {
    setAddDefaultType(type);
    setIsAdding(true);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsTransferring(true)}
          disabled={accounts.length < 2}
          title={
            accounts.length < 2
              ? "Add at least two accounts to transfer"
              : "Transfer between accounts"
          }
        >
          Transfer
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => openAddAccount("cash")}
        >
          Add cash
        </Button>
        <Button type="button" onClick={() => openAddAccount("checking")}>
          Add account
        </Button>
      </div>

      <OfflineBanner fxStale={fxStale} />

      <div className="mt-6 space-y-6">
        <AccountList
          accounts={accounts}
          baseCurrency={baseCurrency}
          onEdit={setEditingAccount}
        />
      </div>

      <AccountTransferHistory
        transfers={transfers}
        onEdit={setEditingTransfer}
      />

      <AccountEditModal
        account={editingAccount}
        open={editingAccount !== null || isAdding}
        defaultType={addDefaultType}
        onClose={() => {
          setEditingAccount(null);
          setIsAdding(false);
          setAddDefaultType("checking");
        }}
      />

      <AccountTransferModal
        accounts={accounts}
        open={isTransferring}
        onClose={() => setIsTransferring(false)}
      />

      <AccountTransferModal
        accounts={accounts}
        transfer={editingTransfer}
        open={editingTransfer !== null}
        onClose={() => setEditingTransfer(null)}
      />
    </>
  );
}
