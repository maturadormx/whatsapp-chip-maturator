import { createGroupCatalogEntry, listChipGroupsForChip, listGroupCatalogEntries, upsertChipGroup } from "../../db";

export async function loadChipGroups(chipId: number, userId: number) {
  return listChipGroupsForChip(chipId, userId);
}

export async function saveChipGroup(input: Parameters<typeof upsertChipGroup>[0]) {
  return upsertChipGroup(input);
}

export async function loadGroupCatalog(filters?: Parameters<typeof listGroupCatalogEntries>[0]) {
  return listGroupCatalogEntries(filters);
}

export async function saveGroupCatalogEntry(input: Parameters<typeof createGroupCatalogEntry>[0]) {
  return createGroupCatalogEntry(input);
}
