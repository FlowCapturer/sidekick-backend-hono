// import { getDatabaseConnection } from '../db-connection.js';

import { Context } from "hono";
import { IHonoAppBinding } from "../types.js";

/**
 * This function will take care of start and release the connection with DB.
 * @param promiseFn
 */
export const initializeConnection = async (promiseFn: () => Promise<any>) => {
  // let connection;

  try {
    // const dbConnectionPool = getDatabaseConnection();
    // connection = await dbConnectionPool.getConnection();

    return await promiseFn();
  } finally {
    // connection?.release();
  }
};

/**
 * Inserts multiple records into the specified table.
 * @param tableName - The name of the table to insert into
 * @param records - Array of objects representing the records to insert
 * @param c - Hono Context
 * @returns - The result metadata of the insert operation
 */
export const insertRecords = async (
  tableName: string,
  records: Record<string, any>[],
  c: Context<IHonoAppBinding>,
) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("records must be a non-empty array");
  }

  const keys = Object.keys(records[0]); // take keys from the first object
  const placeholders = records
    .map(() => `(${keys.map(() => "?").join(", ")})`) // (?,?,?), (?,?,?) ...
    .join(", ");

  const values = records.flatMap((record) => keys.map((key) => record[key]));

  const sql = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES ${placeholders}`;

  try {
    const { meta } = await c.env.DB.prepare(sql)
      .bind(...values)
      .run();

    // Check if all records were inserted
    if (meta.changes !== records.length) {
      throw new Error(
        `Expected to insert ${records.length} records, but only ${meta.changes} were inserted.`,
      );
    }

    return meta;
  } catch (e) {
    throw e;
  }
};

/**
 * Updates records in the specified table that match the where condition.
 * @param tableName - The name of the table to update
 * @param updateValues - Object containing the fields and values to update
 * @param where - Object containing the where conditions
 * @param c - Hono Context
 * @returns - The result of the update operation
 */
export const updateRecords = async (
  tableName: string,
  updateValues: Record<string, any>,
  where: Record<string, any>,
  c: Context<IHonoAppBinding>,
) => {
  const updateKeys = Object.keys(updateValues);
  const whereKeys = Object.keys(where);

  if (updateKeys.length === 0) {
    throw new Error("updateValues must not be empty");
  }

  if (!whereKeys || whereKeys.length === 0) {
    throw new Error("where must not be empty");
  }

  const setClause = updateKeys.map((key) => `${key} = ?`).join(", ");
  const whereClause = whereKeys.length
    ? "WHERE " + whereKeys.map((key) => `${key} = ?`).join(" AND ")
    : "";

  const values = [
    ...updateKeys.map((key) => updateValues[key]),
    ...whereKeys.map((key) => where[key]),
  ];

  const sql = `UPDATE ${tableName} SET ${setClause} ${whereClause}`;

  try {
    const { meta } = await c.env.DB.prepare(sql)
      .bind(...values)
      .run();
    return meta;
  } catch (e) {
    throw e;
  }
};

/**
 * This method fetch the records from DB.
 * @param tableName
 * @param fieldNames
 * @param where
 * @param c - Hono Context
 * @returns - Returns an array of object for the satisfied conditions.
 */
export const selectRecords = async (
  tableName: string,
  fieldNames: string[] = ["*"],
  where: Record<string, any> = {},
  c: Context<IHonoAppBinding>,
) => {
  const whereKeys = Object.keys(where);

  const whereClause = whereKeys.length
    ? "WHERE " + whereKeys.map((key) => `${key} = ?`).join(" AND ")
    : "";

  const values = whereKeys.map((key) => where[key]);
  const fields = fieldNames.length ? fieldNames.join(", ") : "*";

  const sql = `SELECT ${fields} FROM ${tableName} ${whereClause}`;
  try {
    const { results } = await c.env.DB.prepare(sql)
      .bind(...values)
      .all();
    return results;
  } catch (e) {
    throw e;
  }
};

/**
 * Executes a raw SQL query.
 * @param sql - The SQL query to execute
 * @param c - Hono Context
 * @param values - Optional array of values to bind to the query
 * @returns - The results of the query
 */
export const executeSql = async (
  sql: string,
  c: Context<IHonoAppBinding>,
  values: any[] = [],
) => {
  try {
    let query = c.env.DB.prepare(sql);
    if (values.length > 0) {
      query = query.bind(...values);
    }
    const { results } = await query.all();
    return results;
  } catch (e) {
    throw e;
  }
};

export const isTruthyValue = (value: unknown) =>
  value === 1 || value === "1" || value === true;
