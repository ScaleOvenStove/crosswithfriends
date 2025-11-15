import {test, expect} from '@playwright/experimental-ct-react';
import React from 'react';

import Nav from '../../../components/common/Nav';
import {TestWrapper} from '../../utils';

test('Nav renders without crashing', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Nav />
    </TestWrapper>
  );

  // Nav should render (basic smoke test)
  await expect(component).toBeVisible();
});

test('Nav renders with v2 prop', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Nav v2 />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('Nav renders with canLogin prop', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Nav canLogin />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('Nav is hidden when hidden prop is true', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Nav hidden />
    </TestWrapper>
  );

  await expect(component).not.toBeVisible();
});
