export function normalizeRealmSlug(realm) {
  return realm.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function classToBotName(characterClass) {
  const normalized = String(typeof characterClass === 'object' ? characterClass?.name : characterClass || '')
    .toLowerCase().replace(/[^a-z]/g, '');
  const aliases = {
    druid: 'Druid', evoker: 'Evoker', hunter: 'Hunter', mage: 'Mage', monk: 'Monk', paladin: 'Paladin',
    priest: 'Priest', rogue: 'Rogue', shaman: 'Shaman', warlock: 'Warlock', warrior: 'Warrior',
    deathknight: 'DK', demonhunter: 'DH', dk: 'DK', dh: 'DH'
  };
  return aliases[normalized] || null;
}

export async function fetchRaiderIoCharacter(region, realm, name) {
  const realmSlug = normalizeRealmSlug(realm);
  const url = new URL('https://raider.io/api/v1/characters/profile');
  url.searchParams.set('region', region);
  url.searchParams.set('realm', realmSlug);
  url.searchParams.set('name', name);
  url.searchParams.set('fields', 'gear,mythic_plus_highest_level_runs');

  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (response.status === 429) throw new Error('RATE_LIMITED');
  if (!response.ok) throw new Error(`RAIDER_IO_${response.status}`);
  const profile = await response.json();
  const profileClass = classToBotName(profile.class);
  const runs = Array.isArray(profile.mythic_plus_highest_level_runs) ? profile.mythic_plus_highest_level_runs : [];
  const bestRun = runs.reduce((best, run) => {
    const level = Number(run.mythic_level ?? run.mythicLevel ?? run.level ?? 0);
    return level > (best?.level || 0) ? { level, dungeon: typeof run.dungeon === 'string' ? run.dungeon : run.dungeon?.name } : best;
  }, null);
  const itemLevel = Number(profile.gear?.item_level_equipped);
  if (!Number.isFinite(itemLevel) || !profileClass) throw new Error('INCOMPLETE_PROFILE');
  let thumbnailUrl = null;
  try {
    const candidate = new URL(profile.thumbnail_url);
    if (candidate.protocol === 'https:') thumbnailUrl = candidate.toString();
  } catch {
    // Some Raider.IO profiles do not have a character image.
  }

  return {
    characterName: profile.name || name,
    characterClass: profileClass,
    realm,
    realmSlug,
    region,
    itemLevel,
    thumbnailUrl,
    bestKey: bestRun?.level || null,
    bestDungeon: bestRun?.dungeon || null,
    dataUpdatedAt: new Date().toISOString()
  };
}

export function raiderIoCharacterUrl(region, realmSlug, characterName) {
  return `https://raider.io/characters/${encodeURIComponent(region)}/${encodeURIComponent(realmSlug)}/${encodeURIComponent(characterName)}`;
}
