import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
`);

export function getAssignment(guildId, userId) {
  return db.prepare('SELECT class_name, assigned_at FROM assignments WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

export function getAssignments(guildId) {
  return db.prepare('SELECT user_id, class_name, assigned_at FROM assignments WHERE guild_id = ? ORDER BY class_name').all(guildId);
}

export function getUsedClasses(guildId) {
  return new Set(db.prepare('SELECT class_name FROM assignments WHERE guild_id = ?').all(guildId).map((row) => row.class_name));
}

export function assignClass(guildId, userId, className) {
  return db.prepare('INSERT INTO assignments (guild_id, user_id, class_name) VALUES (?, ?, ?)').run(guildId, userId, className);
}

export function resetUser(guildId, userId) {
  return db.prepare('DELETE FROM assignments WHERE guild_id = ? AND user_id = ?').run(guildId, userId).changes;
}

export function resetGuild(guildId) {
  return db.prepare('DELETE FROM assignments WHERE guild_id = ?').run(guildId).changes;
}

export function savePanel(guildId, channelId, messageId) {
  db.prepare(`INSERT INTO panels (guild_id, channel_id, message_id) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id, message_id=excluded.message_id, updated_at=CURRENT_TIMESTAMP`)
    .run(guildId, channelId, messageId);
}

export function getPanel(guildId) {
  return db.prepare('SELECT channel_id, message_id FROM panels WHERE guild_id = ?').get(guildId);
}
