import type {CellData} from '@crosswithfriends/shared/types';

export const hashGridRow = (row: CellData[], misc: object) => JSON.stringify([row, misc]);
