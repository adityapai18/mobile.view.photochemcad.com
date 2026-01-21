import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

// --- Interfaces ---

export interface AbsorptionData {
  compound_id: string;
  wavelength: number;
  coefficient: number;
}

export interface EmissionData {
  compound_id: string;
  wavelength: number;
  normalized: number;
}

export interface Compound {
  id: string;
  name: string;
  slug: string;
  database_name: string;
  category_name: string;
  has_absorption_data: string; // '0' or '1'
  has_emission_data: string;   // '0' or '1'
}

export interface DatabaseCategory {
  name: string;
  count: number;
}

// --- Database Configuration ---

const DB_NAME = 'photochemcad.db';
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initializes and opens the database.
 * If the database file does not exist in the document directory,
 * it copies it from the app bundle (assets).
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  const sqlDir = `${FileSystem.documentDirectory}SQLite/`;
  const dbUri = `${sqlDir}${DB_NAME}`;
  const fileInfo = await FileSystem.getInfoAsync(dbUri);

  if (!fileInfo.exists) {
    console.log('[DB] Database not found, copying from assets...');
    try {
      // Create SQLite directory if it doesn't exist
      await FileSystem.makeDirectoryAsync(sqlDir, { intermediates: true });
      
      // Load the database asset
      const dbAsset = require('@/assets/data/photochemcad.db');
      const asset = Asset.fromModule(dbAsset);
      
      // Download the asset to get its local URI
      await asset.downloadAsync();
      
      if (!asset.uri) {
        throw new Error('Failed to download asset: uri is missing');
      }

      // Download/copy the database file to the SQLite directory
      await FileSystem.downloadAsync(asset.uri, dbUri);

      console.log('[DB] Database copied successfully.');
    } catch (error) {
      console.error('[DB] Error copying database:', error);
      throw new Error('Failed to initialize database file.');
    }
  }

  try {
    db = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });
    return db;
  } catch (error) {
    console.error('[DB] Error opening database:', error);
    throw new Error('Failed to open database connection.');
  }
}

// --- Query Functions ---

/**
 * Get all compounds that have valid data (Absorption or Emission).
 */
export async function getCompounds(): Promise<Compound[]> {
  const database = await getDatabase();
  return await database.getAllAsync<Compound>(`
    SELECT *
    FROM compounds 
    WHERE has_absorption_data = '1' OR has_emission_data = '1'
    ORDER BY name ASC
  `);
}

/**
 * Get a single compound by its ID.
 */
export async function getCompoundById(id: string): Promise<Compound | null> {
  const database = await getDatabase();
  return await database.getFirstAsync<Compound>(`
    SELECT *
    FROM compounds 
    WHERE id = ?
  `, [id]);
}

/**
 * Get absorption spectrum data for a specific compound.
 */
export async function getAbsorptionData(compoundId: string): Promise<AbsorptionData[]> {
  const database = await getDatabase();
  return await database.getAllAsync<AbsorptionData>(`
    SELECT compound_id, wavelength, coefficient
    FROM compounds_absorptions
    WHERE compound_id = ?
    ORDER BY wavelength ASC
  `, [compoundId]);
}

/**
 * Get emission spectrum data for a specific compound.
 */
export async function getEmissionData(compoundId: string): Promise<EmissionData[]> {
  const database = await getDatabase();
  return await database.getAllAsync<EmissionData>(`
    SELECT compound_id, wavelength, normalized
    FROM compounds_emissions
    WHERE compound_id = ?
    ORDER BY wavelength ASC
  `, [compoundId]);
}

/**
 * Get a list of database categories and the count of compounds in each.
 */
export async function getDatabaseCategories(): Promise<DatabaseCategory[]> {
  const database = await getDatabase();
  console.log('DB fetching categories'  );
  const result = await database.getAllAsync<{ database_name: string; count: number }>(`
    SELECT database_name, COUNT(*) as count
    FROM compounds    
    WHERE has_absorption_data = '1' OR has_emission_data = '1'
    GROUP BY database_name
    ORDER BY database_name ASC
  `);
  
  return result.map(r => ({ name: r.database_name, count: r.count }));
}

/**
 * Get compounds filtered by a specific database category.
 */
export async function getCompoundsByDatabase(databaseName: string, limit: number = 50): Promise<Compound[]> {
  const database = await getDatabase();
  return await database.getAllAsync<Compound>(`
    SELECT *
    FROM compounds 
    WHERE database_name = ? 
      AND (has_absorption_data = '1' OR has_emission_data = '1')
    ORDER BY name ASC
    LIMIT ?
  `, [databaseName, limit]);
}

/**
 * Search for compounds by name or ID within a specific database category.
 */
export async function searchCompoundsInDatabase(databaseName: string, query: string): Promise<Compound[]> {
  const database = await getDatabase();
  const searchTerm = `%${query}%`;
  return await database.getAllAsync<Compound>(`
    SELECT *
    FROM compounds 
    WHERE database_name = ? 
      AND (has_absorption_data = '1' OR has_emission_data = '1')
      AND (name LIKE ? OR id LIKE ?)
    ORDER BY name ASC
    LIMIT 50
  `, [databaseName, searchTerm, searchTerm]);
}

/**
 * Global search for compounds by name or ID across all categories.
 */
export async function searchCompounds(query: string): Promise<Compound[]> {
  const database = await getDatabase();
  const searchTerm = `%${query}%`;
  return await database.getAllAsync<Compound>(`
    SELECT *
    FROM compounds 
    WHERE (has_absorption_data = '1' OR has_emission_data = '1')
      AND (name LIKE ? OR id LIKE ?)
    ORDER BY name ASC
    LIMIT 50
  `, [searchTerm, searchTerm]);
}