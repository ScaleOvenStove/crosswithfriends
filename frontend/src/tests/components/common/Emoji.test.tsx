import {test, expect} from '@playwright/experimental-ct-react';
import React from 'react';

import Emoji from '../../../components/common/Emoji';
import {TestWrapper} from '../../utils';

test('Emoji renders with emoji string', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Emoji emoji=":smile:" />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('Emoji renders with big prop', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Emoji emoji=":smile:" big />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('Emoji applies custom className', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Emoji emoji=":smile:" className="custom-class" />
    </TestWrapper>
  );

  const span = component.locator('span.custom-class');
  await expect(span).toBeVisible();
});

test('Emoji returns null for invalid emoji', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Emoji emoji=":invalid:" />
    </TestWrapper>
  );

  // Component should not render anything for invalid emoji
  await expect(component.locator('span')).toHaveCount(0);
});
