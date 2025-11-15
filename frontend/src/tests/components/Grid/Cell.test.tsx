import {test, expect} from '@playwright/experimental-ct-react';
import React from 'react';

import Cell from '../../../components/Grid/Cell';
import {TestWrapper} from '../../utils';

const mockCellProps = {
  r: 0,
  c: 0,
  value: 'A',
  black: false,
  number: 1,
  cursors: [],
  pings: [],
  solvedByIconSize: 0,
  selected: false,
  highlighted: false,
  frozen: false,
  circled: false,
  shaded: false,
  referenced: false,
  canFlipColor: false,
  pickupType: undefined,
  attributionColor: '',
  cellStyle: {} as any,
  myColor: '#000000',
  onClick: () => {},
  onContextMenu: () => {},
};

test('Cell renders with value', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Cell {...mockCellProps} />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('Cell calls onClick when clicked', async ({mount}) => {
  let clicked = false;
  const onClick = () => {
    clicked = true;
  };

  const component = await mount(
    <TestWrapper>
      <Cell {...mockCellProps} onClick={onClick} />
    </TestWrapper>
  );

  await component.click();
  expect(clicked).toBe(true);
});

test('Cell calls onContextMenu on right click', async ({mount}) => {
  let contextMenuCalled = false;
  const onContextMenu = () => {
    contextMenuCalled = true;
  };

  const component = await mount(
    <TestWrapper>
      <Cell {...mockCellProps} onContextMenu={onContextMenu} />
    </TestWrapper>
  );

  await component.click({button: 'right'});
  expect(contextMenuCalled).toBe(true);
});

test('Cell renders as black cell', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Cell {...mockCellProps} black />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('Cell shows number when provided', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Cell {...mockCellProps} number={1} />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('Cell shows selected state', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Cell {...mockCellProps} selected />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});
