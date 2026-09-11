const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function openLibraryDatabase(stateRoot) {
  const dbPath = path.resolve(process.env.ASSET_BROWSER_DB_PATH || path.join(stateRoot, 'asset-library.sqlite'));
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS prompts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generations (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_roots (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS collections (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS saved_filters (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS asset_files (asset_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS asset_relations (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tags (name TEXT PRIMARY KEY, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS asset_tags (asset_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY(asset_id, tag));
    CREATE TABLE IF NOT EXISTS collection_assets (collection_id TEXT NOT NULL, asset_id TEXT NOT NULL, PRIMARY KEY(collection_id, asset_id));
  `);
  return { db, dbPath };
}

function readRows(db, table) {
  return db.prepare(`SELECT payload FROM ${table} ORDER BY updated_at DESC`).all().flatMap(row => {
    try { return [JSON.parse(row.payload)]; } catch { return []; }
  });
}

function replaceRows(db, table, rows) {
  const insert = db.prepare(`INSERT INTO ${table} (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`);
  const ids = new Set();
  for (const row of rows) {
    if (!row?.id) continue;
    const updated = String(row.updatedAt || row.updated_at || new Date().toISOString());
    insert.run(String(row.id), JSON.stringify(row), updated);
    ids.add(String(row.id));
  }
  const existing = db.prepare(`SELECT id FROM ${table}`).all();
  const remove = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
  for (const row of existing) if (!ids.has(String(row.id))) remove.run(String(row.id));
}

function saveLibrary(db, { assets = [], prompts = [], generations = [], sourceRoots = [], collections = [], savedFilters = [], assetRelations = [] } = {}) {
  db.exec('BEGIN');
  try {
    replaceRows(db, 'assets', assets);
    replaceRows(db, 'prompts', prompts);
    replaceRows(db, 'generations', generations);
    replaceRows(db, 'source_roots', sourceRoots);
    replaceRows(db, 'collections', collections);
    replaceRows(db, 'saved_filters', savedFilters);
    replaceRows(db, 'asset_relations', assetRelations);
    const fileInsert = db.prepare(`INSERT INTO asset_files (asset_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(asset_id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`);
    const tagInsert = db.prepare(`INSERT OR IGNORE INTO tags (name, updated_at) VALUES (?, ?)`);
    const assetTagInsert = db.prepare(`INSERT OR IGNORE INTO asset_tags (asset_id, tag) VALUES (?, ?)`);
    db.exec('DELETE FROM asset_files; DELETE FROM asset_tags; DELETE FROM tags;');
    for (const asset of assets) {
      if (asset?.id) fileInsert.run(String(asset.id), JSON.stringify({ assetId: asset.id, path: asset.path || null, relativePath: asset.relativePath || null, availability: asset.availability || (asset.missing ? 'missing' : 'available'), sourceRootId: asset.sourceRootId || asset.projectId || null }), String(asset.updatedAt || new Date().toISOString()));
      for (const tag of Array.isArray(asset?.tags) ? asset.tags : []) if (String(tag).trim()) { const value = String(tag).trim(); tagInsert.run(value, new Date().toISOString()); assetTagInsert.run(String(asset.id), value); }
    }
    db.exec('DELETE FROM collection_assets;');
    const addCollectionAsset = db.prepare('INSERT OR IGNORE INTO collection_assets (collection_id, asset_id) VALUES (?, ?)');
    for (const collection of collections) for (const assetId of Array.isArray(collection?.assetIds) ? collection.assetIds : []) addCollectionAsset.run(String(collection.id), String(assetId));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function loadLibrary({ stateRoot, jsonPaths = {} }) {
  const { db, dbPath } = openLibraryDatabase(stateRoot);
  const assets = readRows(db, 'assets');
  const prompts = readRows(db, 'prompts');
  const generations = readRows(db, 'generations');
  const sourceRoots = readRows(db, 'source_roots');
  const collections = readRows(db, 'collections').map(row => ({ ...row, assetIds: Array.isArray(row.assetIds) ? row.assetIds : db.prepare('SELECT asset_id FROM collection_assets WHERE collection_id = ?').all(row.id).map(item => item.asset_id) }));
  const savedFilters = readRows(db, 'saved_filters');
  const assetRelations = readRows(db, 'asset_relations');
  if (!assets.length && !prompts.length && !generations.length && !sourceRoots.length && !collections.length && !savedFilters.length && !assetRelations.length) {
    const readJson = file => {
      try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(value) ? value : []; } catch { return []; }
    };
    const migrated = {
      assets: readJson(jsonPaths.assets || path.join(stateRoot, 'assets.json')),
      prompts: readJson(jsonPaths.prompts || path.join(stateRoot, 'prompts.json')),
      generations: readJson(jsonPaths.generations || path.join(stateRoot, 'generations.json')),
      sourceRoots: [], collections: [], savedFilters: [], assetRelations: [],
    };
    if (migrated.assets.length || migrated.prompts.length || migrated.generations.length) saveLibrary(db, migrated);
    return { db, dbPath, ...migrated };
  }
  return { db, dbPath, assets, prompts, generations, sourceRoots, collections, savedFilters, assetRelations };
}

module.exports = { openLibraryDatabase, loadLibrary, saveLibrary };
