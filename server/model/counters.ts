import _ from 'lodash';
import {pool} from './pool.js';
import {logger} from '../utils/logger.js';

export async function incrementGid(): Promise<string> {
  const startTime = Date.now();
  const {rows} = await pool.query(
    `
      SELECT nextval('gid_counter')
    `
  );
  const ms = Date.now() - startTime;
  logger.debug(`incrementGid took ${ms}ms`);
  return _.first(rows)!.nextval as string;
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
  return _.first(rows)!.nextval as string;
}
