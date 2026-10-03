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
`);

// Keep existing installations working when upgrading from a class-only version.
const assignmentColumns = db.prepare('PRAGMA table_info(assignments)').all().map((column) => column.name);
if (!assignmentColumns.includes('role')) db.exec('ALTER TABLE assignments ADD COLUMN role TEXT');
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
  return db.prepare('DELETE FROM assignments WHERE guild_id = ? AND user_id = ?').run(guildId, userId).changes;
}

export function updateRole(guildId, userId, role) {
  return db.prepare('UPDATE assignments SET role = ? WHERE guild_id = ? AND user_id = ?').run(role, guildId, userId).changes;
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
