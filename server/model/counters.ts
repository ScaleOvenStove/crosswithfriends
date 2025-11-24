import {logger} from '../utils/logger.js';

import {pool} from './pool.js';

export async function incrementGid(): Promise<string> {
  const startTime = Date.now();
  const {rows} = await pool.query(
    `
      SELECT nextval('gid_counter')
    `
  );
  const ms = Date.now() - startTime;
  logger.debug(`incrementGid took ${ms}ms`);
  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error('Failed to increment GID');
  }
  return firstRow.nextval as string;
}

export async function incrementPid(): Promise<string> {
  const startTime = Date.now();
  const {rows} = await pool.query(
    `
      SELECT nextval('pid_counter')
    `
  );
  const ms = Date.now() - startTime;
  logger.debug(`incrementPid took ${ms}ms`);
  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error('Failed to increment PID');
  }
  return firstRow.nextval as string;
}
