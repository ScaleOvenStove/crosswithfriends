import powerups from '@crosswithfriends/shared/lib/powerups';
import type {CellData, Cursor} from '@crosswithfriends/shared/types';

export interface CellStyle {
  backgroundColor: string;
}
export interface CellStyles extends React.CSSProperties {
  selected: CellStyle;
  highlighted: CellStyle;
  frozen: CellStyle;
}

export interface Ping extends Cursor {
  age: number;
}
export type GridDataWithColor = (CellData & {attributionColor: string})[][];

export interface EnhancedCellData extends CellData {
  r: number;
  c: number;

  // Player interactions
  cursors: Cursor[];
  pings: Ping[];
  solvedByIconSize: number;

  // Cell states
  selected: boolean;
  highlighted: boolean;
  frozen: boolean;
  circled: boolean;
  shaded: boolean;
  referenced: boolean;
  canFlipColor: boolean;
  pickupType?: keyof typeof powerups;

  // Styles
  attributionColor: string;
  cellStyle: CellStyles;
  myColor: string;
}

export type EnhancedGridData = EnhancedCellData[][];

export type CellCoords = {
  r: number;
  c: number;
};

export type ClueCoords = {
  ori: string;
  num: number;
};

import type {Pickup} from '../../types/battle';

export type BattlePickup = Pickup;
