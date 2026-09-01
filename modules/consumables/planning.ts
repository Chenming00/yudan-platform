export interface StockPlanEntry { id: number; availableQuantity: number; expiryDate: Date | string | null; createdAt: Date | string; }

const timestamp = (value: Date | string) => value instanceof Date ? value.getTime() : new Date(value).getTime();

export function compareFefo(left: StockPlanEntry, right: StockPlanEntry) {
  if (left.expiryDate && right.expiryDate) {
    const difference = timestamp(left.expiryDate) - timestamp(right.expiryDate);
    if (difference) return difference;
  } else if (left.expiryDate) return -1;
  else if (right.expiryDate) return 1;
  return timestamp(left.createdAt) - timestamp(right.createdAt) || left.id - right.id;
}

export function planDeductions(entries: StockPlanEntry[], quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99_999) throw new Error("数量必须是 1 到 99999 的整数。");
  const available = entries.reduce((sum, entry) => sum + entry.availableQuantity, 0);
  if (available < quantity) throw new Error("库存不足。");
  let remaining = quantity;
  const changes: Array<{ id: number; beforeQuantity: number; afterQuantity: number; quantity: number }> = [];
  for (const entry of entries.toSorted(compareFefo)) {
    if (!remaining) break;
    const deducted = Math.min(entry.availableQuantity, remaining);
    if (!deducted) continue;
    changes.push({ id: entry.id, beforeQuantity: entry.availableQuantity, afterQuantity: entry.availableQuantity - deducted, quantity: deducted });
    remaining -= deducted;
  }
  return changes;
}

export function planInventoryCount(entries: StockPlanEntry[], targetQuantity: number) {
  if (!Number.isInteger(targetQuantity) || targetQuantity < 0 || targetQuantity > 99_999) throw new Error("盘点数量必须是 0 到 99999 的整数。");
  const currentQuantity = entries.reduce((sum, entry) => sum + entry.availableQuantity, 0);
  const difference = targetQuantity - currentQuantity;
  if (!difference) return { currentQuantity, difference, changes: [] as Array<{ id: number; beforeQuantity: number; afterQuantity: number; quantity: number }> };
  if (difference < 0) return { currentQuantity, difference, changes: planDeductions(entries, Math.abs(difference)) };
  const newest = entries.toSorted((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt) || right.id - left.id)[0];
  return { currentQuantity, difference, changes: newest ? [{ id: newest.id, beforeQuantity: newest.availableQuantity, afterQuantity: newest.availableQuantity + difference, quantity: difference }] : [] };
}
