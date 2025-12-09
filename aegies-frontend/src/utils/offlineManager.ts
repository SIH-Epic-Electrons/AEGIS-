/**
 * Offline queue manager for actions and evidence
 * Uses SQLite for persistent storage
 */

import * as SQLite from 'expo-sqlite';
import { Action, Evidence, Alert } from '../types';
import { CONFIG } from '../constants/config';

let db: SQLite.SQLiteDatabase | null = null;

const initDatabase = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('aegis_offline.db');
    
    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        alertId TEXT,
        type TEXT,
        timestamp TEXT,
        status TEXT,
        data TEXT
      );
      
      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        alertId TEXT,
        type TEXT,
        uri TEXT,
        timestamp TEXT,
        annotations TEXT,
        redacted INTEGER,
        synced INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS alerts_cache (
        id TEXT PRIMARY KEY,
        data TEXT,
        timestamp TEXT
      );
    `);
  }
  return db;
};

export const offlineManager = {
  /**
   * Queue an action for offline sync
   */
  async queueAction(action: Action): Promise<void> {
    const database = await initDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO actions (id, alertId, type, timestamp, status, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        action.id,
        action.alertId,
        action.type,
        action.timestamp,
        action.status,
        JSON.stringify(action.data || {}),
      ]
    );
  },

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<Action[]> {
    const database = await initDatabase();
    const result = await database.getAllAsync<{
      id: string;
      alertId: string;
      type: string;
      timestamp: string;
      status: string;
      data: string;
    }>('SELECT * FROM actions WHERE status = ?', ['pending']);

    return result.map((row) => ({
      id: row.id,
      alertId: row.alertId,
      type: row.type as Action['type'],
      timestamp: row.timestamp,
      status: row.status as Action['status'],
      data: row.data ? JSON.parse(row.data) : undefined,
    }));
  },

  /**
   * Queue evidence for offline sync
   */
  async queueEvidence(evidence: Evidence): Promise<void> {
    const database = await initDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO evidence (id, alertId, type, uri, timestamp, annotations, redacted, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidence.id,
        evidence.alertId,
        evidence.type,
        evidence.uri,
        evidence.timestamp,
        JSON.stringify(evidence.annotations || []),
        evidence.redacted ? 1 : 0,
        evidence.synced ? 1 : 0,
      ]
    );
  },

  /**
   * Get all unsynced evidence
   */
  async getUnsyncedEvidence(): Promise<Evidence[]> {
    const database = await initDatabase();
    const result = await database.getAllAsync<{
      id: string;
      alertId: string;
      type: string;
      uri: string;
      timestamp: string;
      annotations: string;
      redacted: number;
      synced: number;
    }>('SELECT * FROM evidence WHERE synced = ?', [0]);

    return result.map((row) => ({
      id: row.id,
      alertId: row.alertId,
      type: row.type as Evidence['type'],
      uri: row.uri,
      timestamp: row.timestamp,
      annotations: row.annotations ? JSON.parse(row.annotations) : undefined,
      redacted: row.redacted === 1,
      synced: row.synced === 1,
    }));
  },

  /**
   * Cache alerts for offline access
   */
  async cacheAlerts(alerts: Alert[]): Promise<void> {
    const database = await initDatabase();
    for (const alert of alerts) {
      await database.runAsync(
        `INSERT OR REPLACE INTO alerts_cache (id, data, timestamp)
         VALUES (?, ?, ?)`,
        [alert.id, JSON.stringify(alert), new Date().toISOString()]
      );
    }
  },

  /**
   * Get cached alerts
   */
  async getCachedAlerts(): Promise<Alert[]> {
    const database = await initDatabase();
    const result = await database.getAllAsync<{
      id: string;
      data: string;
      timestamp: string;
    }>('SELECT * FROM alerts_cache ORDER BY timestamp DESC LIMIT ?', [
      CONFIG.MAX_OFFLINE_QUEUE,
    ]);

    return result.map((row) => JSON.parse(row.data));
  },

  /**
   * Mark action as synced
   */
  async markActionSynced(actionId: string): Promise<void> {
    const database = await initDatabase();
    await database.runAsync(
      'UPDATE actions SET status = ? WHERE id = ?',
      ['synced', actionId]
    );
  },

  /**
   * Mark evidence as synced
   */
  async markEvidenceSynced(evidenceId: string): Promise<void> {
    const database = await initDatabase();
    await database.runAsync(
      'UPDATE evidence SET synced = ? WHERE id = ?',
      [1, evidenceId]
    );
  },

  /**
   * Clear synced items
   */
  async clearSyncedItems(): Promise<void> {
    const database = await initDatabase();
    await database.runAsync('DELETE FROM actions WHERE status = ?', ['synced']);
    await database.runAsync('DELETE FROM evidence WHERE synced = ?', [1]);
  },
};

