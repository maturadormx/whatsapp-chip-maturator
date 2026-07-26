import {
  createEcosystemEvent,
  createMaturationTarget,
  getUserChips,
  listChipGroupsForChip,
  listEcosystemEvents,
  listGroupCatalogEntries,
} from "../../db";

function normalizePhone(raw?: string | null) {
  return String(raw ?? "").replace(/\D/g, "");
}

function buildInternalGroupName(city: string, ddd: string) {
  return `Rede ${city} ${ddd}`;
}

export async function refreshInternalEcosystem(userId: number) {
  const chips = await getUserChips(userId);
  const eligibleChips = chips.filter((chip) => normalizePhone(chip.phoneNumber).length >= 10);
  const recentEvents = await listEcosystemEvents({
    userId,
    limit: 500,
  });

  let createdTargets = 0;
  let mirroredGroups = 0;

  for (const source of eligibleChips) {
    const sourcePhone = normalizePhone(source.phoneNumber);
    for (const target of eligibleChips) {
      if (source.id === target.id) continue;
      const targetPhone = normalizePhone(target.phoneNumber);
      if (!targetPhone) continue;

      const referenceKey = `contact:${source.id}:${target.id}`;
      const exists = recentEvents.some((event) => event.referenceKey === referenceKey);
      if (exists) continue;

      await createMaturationTarget({
        userId,
        targetName: `Chip ${target.chipName}`,
        targetType: "number",
        targetValue: targetPhone,
        notes: `Seed interno do ecossistema a partir do chip ${source.chipName}`,
        isActive: 1,
      }).catch(() => null);

      await createEcosystemEvent({
        userId,
        sourceChipId: source.id,
        targetChipId: target.id,
        eventType: "internal_contact_seeded",
        referenceKey,
        payload: {
          sourceChipName: source.chipName,
          targetChipName: target.chipName,
          targetPhone,
        },
      });
      createdTargets += 1;
    }
  }

  const catalogEntries = await listGroupCatalogEntries({
    userId,
    activeOnly: true,
  });

  for (const chip of eligibleChips) {
    const ddd = normalizePhone(chip.phoneNumber).slice(2, 4) || normalizePhone(chip.phoneNumber).slice(0, 2);
    const chipGroups = await listChipGroupsForChip(chip.id, userId);
    const internalGroup = chipGroups.find((group) => group.origin === "internal" && group.status === "joined");
    if (!internalGroup) continue;

    const referenceKey = `group:${chip.id}:${internalGroup.groupJid}`;
    const alreadyMirrored = recentEvents.some((event) => event.referenceKey === referenceKey);
    if (alreadyMirrored) continue;

    const existsInCatalog = catalogEntries.some((entry) => entry.link === internalGroup.inviteLink);
    if (!existsInCatalog) {
      await createMaturationTarget({
        userId,
        targetName: internalGroup.groupName ?? buildInternalGroupName("Interno", ddd || "00"),
        targetType: "group",
        targetValue: internalGroup.inviteLink ?? internalGroup.groupJid,
        notes: "Grupo interno espelhado pelo EcosystemEngine",
        isActive: 1,
      }).catch(() => null);
    }

    await createEcosystemEvent({
      userId,
      sourceChipId: chip.id,
      eventType: "internal_group_mirrored",
      referenceKey,
      payload: {
        groupJid: internalGroup.groupJid,
        groupName: internalGroup.groupName,
      },
    });
    mirroredGroups += 1;
  }

  return {
    success: true,
    eligibleChips: eligibleChips.length,
    createdTargets,
    mirroredGroups,
  };
}
