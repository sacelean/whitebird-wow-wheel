import Database from 'better-sqlite3';
import { randomInt } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CLASS_BY_NAME } from './classes.js';

const databasePath = resolve(process.env.DATABASE_PATH || './data/whitebird.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    class_name TEXT NOT NULL,
    role TEXT,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id),
    UNIQUE (guild_id, class_name)
  );
  CREATE TABLE IF NOT EXISTS panels (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS wow_characters (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    character_name TEXT NOT NULL,
    realm TEXT NOT NULL,
    realm_slug TEXT NOT NULL,
    region TEXT NOT NULL,
    thumbnail_url TEXT,
    item_level REAL,
    best_key INTEGER,
    best_dungeon TEXT,
    data_updated_at TEXT,
    registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS wow_characters_unique_character
    ON wow_characters (guild_id, region, realm_slug, character_name COLLATE NOCASE);
`);

// Keep existing installations working when upgrading from a class-only version.
const assignmentColumns = db.prepare('PRAGMA table_info(assignments)').all().map((column) => column.name);
if (!assignmentColumns.includes('role')) db.exec('ALTER TABLE assignments ADD COLUMN role TEXT');
const characterColumns = db.prepare('PRAGMA table_info(wow_characters)').all().map((column) => column.name);
if (!characterColumns.includes('thumbnail_url')) db.exec('ALTER TABLE wow_characters ADD COLUMN thumbnail_url TEXT');
const legacyAssignments = db.prepare('SELECT guild_id, user_id, class_name FROM assignments WHERE role IS NULL').all();
const backfillRole = db.prepare('UPDATE assignments SET role = ? WHERE guild_id = ? AND user_id = ?');
for (const assignment of legacyAssignments) {
  const roles = CLASS_BY_NAME.get(assignment.class_name)?.roles;
  if (roles?.length) backfillRole.run(roles[randomInt(roles.length)], assignment.guild_id, assignment.user_id);
}

export function getAssignment(guildId, userId) {
  return db.prepare('SELECT class_name, role, assigned_at FROM assignments WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

export function getAssignments(guildId) {
  return db.prepare('SELECT user_id, class_name, role, assigned_at FROM assignments WHERE guild_id = ? ORDER BY class_name').all(guildId);
}

export function getUsedClasses(guildId) {
  return new Set(db.prepare('SELECT class_name FROM assignments WHERE guild_id = ?').all(guildId).map((row) => row.class_name));
}

export function assignClass(guildId, userId, className, role) {
  return db.prepare('INSERT INTO assignments (guild_id, user_id, class_name, role) VALUES (?, ?, ?, ?)').run(guildId, userId, className, role);
}

export function resetUser(guildId, userId) {
  return db.transaction(() => {
    const removed = db.prepare('DELETE FROM assignments WHERE guild_id = ? AND user_id = ?').run(guildId, userId).changes;
    db.prepare('DELETE FROM wow_characters WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    return removed;
  })();
}

export function updateRole(guildId, userId, role) {
  return db.prepare('UPDATE assignments SET role = ? WHERE guild_id = ? AND user_id = ?').run(role, guildId, userId).changes;
}

export function resetGuild(guildId) {
  return db.transaction(() => {
    const removed = db.prepare('DELETE FROM assignments WHERE guild_id = ?').run(guildId).changes;
    db.prepare('DELETE FROM wow_characters WHERE guild_id = ?').run(guildId);
    return removed;
  })();
}

export function savePanel(guildId, channelId, messageId) {
  db.prepare(`INSERT INTO panels (guild_id, channel_id, message_id) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id, message_id=excluded.message_id, updated_at=CURRENT_TIMESTAMP`)
    .run(guildId, channelId, messageId);
}

export function getPanel(guildId) {
  return db.prepare('SELECT channel_id, message_id FROM panels WHERE guild_id = ?').get(guildId);
}

export function saveWowCharacter(guildId, userId, character) {
  return db.prepare(`INSERT INTO wow_characters
      (guild_id, user_id, character_name, realm, realm_slug, region, thumbnail_url, item_level, best_key, best_dungeon, data_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      character_name=excluded.character_name, realm=excluded.realm, realm_slug=excluded.realm_slug,
      region=excluded.region, thumbnail_url=excluded.thumbnail_url, item_level=excluded.item_level, best_key=excluded.best_key,
      best_dungeon=excluded.best_dungeon, data_updated_at=excluded.data_updated_at, registered_at=CURRENT_TIMESTAMP`)
    .run(guildId, userId, character.characterName, character.realm, character.realmSlug,
      character.region, character.thumbnailUrl || '', character.itemLevel, character.bestKey, character.bestDungeon, character.dataUpdatedAt);
}

export function getWowCharacters(guildId) {
  return db.prepare(`SELECT wc.*, a.class_name, a.role
    FROM wow_characters wc
    JOIN assignments a ON a.guild_id = wc.guild_id AND a.user_id = wc.user_id
    WHERE wc.guild_id = ? ORDER BY wc.character_name COLLATE NOCASE`).all(guildId);
}

export function getWowCharacter(guildId, userId) {
  return db.prepare(`SELECT wc.*, a.class_name, a.role
    FROM wow_characters wc
    JOIN assignments a ON a.guild_id = wc.guild_id AND a.user_id = wc.user_id
    WHERE wc.guild_id = ? AND wc.user_id = ?`).get(guildId, userId);
}

export function updateWowCharacterStats(guildId, userId, stats) {
  return db.prepare(`UPDATE wow_characters
    SET thumbnail_url = ?, item_level = ?, best_key = ?, best_dungeon = ?, data_updated_at = ?
    WHERE guild_id = ? AND user_id = ?`)
    .run(stats.thumbnailUrl || '', stats.itemLevel, stats.bestKey, stats.bestDungeon, stats.dataUpdatedAt, guildId, userId).changes;
}
