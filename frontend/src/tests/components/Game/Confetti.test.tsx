import {test, expect} from '@playwright/experimental-ct-react';
import React from 'react';

import ConfettiComponent from '../../../components/Game/Confetti';
import {TestWrapper} from '../../utils';

test('Confetti renders initially', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <ConfettiComponent />
    </TestWrapper>
  );

  // Confetti canvas should render (it uses canvas-confetti library)
  await expect(component).toBeVisible();

  // Check that canvas element exists
  const canvas = component.locator('canvas');
  await expect(canvas).toBeVisible();
});

test('Confetti canvas is present and visible', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <ConfettiComponent />
    </TestWrapper>
  );

  // Canvas should be visible and have proper styling
  const canvas = component.locator('canvas');
  await expect(canvas).toBeVisible();

  // Wait a bit to ensure confetti animation starts
  await component.waitFor({timeout: 1000});
});
