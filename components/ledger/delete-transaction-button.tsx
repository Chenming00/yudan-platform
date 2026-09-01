"use client";

import { Trash2 } from "lucide-react";

import { deleteTransactionAction } from "@/app/(platform)/ledger/actions";
import { Button } from "@/components/ui/button";

export function DeleteTransactionButton({ transactionId }: { transactionId: string }) {
  return (
    <form action={deleteTransactionAction} onSubmit={(event) => {
      if (!window.confirm("确认删除这条账目？记录会被软删除并保留审计信息。")) event.preventDefault();
    }}>
      <input name="transactionId" type="hidden" value={transactionId} />
      <Button type="submit" variant="destructive"><Trash2 />删除</Button>
    </form>
  );
}
