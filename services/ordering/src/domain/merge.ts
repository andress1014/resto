export interface ModifierRef {
  groupId: string;
  optionId: string;
}

export function canonicalModifierKey(modifiers: ModifierRef[]): string {
  if (!modifiers || modifiers.length === 0) return '';
  return [...modifiers]
    .sort((a, b) => {
      const cmpGroup = a.groupId.localeCompare(b.groupId);
      if (cmpGroup !== 0) return cmpGroup;
      return a.optionId.localeCompare(b.optionId);
    })
    .map((m) => `${m.groupId}:${m.optionId}`)
    .join('|');
}

export function canMergeCartLines(
  productIdA: string,
  modifiersA: ModifierRef[],
  productIdB: string,
  modifiersB: ModifierRef[]
): boolean {
  if (productIdA !== productIdB) return false;
  return canonicalModifierKey(modifiersA) === canonicalModifierKey(modifiersB);
}
