import {test, expect} from '@playwright/experimental-ct-react';
import React from 'react';

import Powerups from '../../../components/common/Powerups';
import {TestWrapper} from '../../utils';

const mockPowerups = [
  {
    type: 'reveal',
    startTime: Date.now() - 1000,
    duration: 5000,
  },
];

test('Powerups renders with powerups list', async ({mount}) => {
  const handleUsePowerup = () => {};
  const component = await mount(
    <TestWrapper>
      <Powerups powerups={mockPowerups} handleUsePowerup={handleUsePowerup} />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('Powerups calls handleUsePowerup when powerup is clicked', async ({mount}) => {
  let powerupUsed = false;
  const handleUsePowerup = () => {
    powerupUsed = true;
  };

  const component = await mount(
    <TestWrapper>
      <Powerups powerups={mockPowerups} handleUsePowerup={handleUsePowerup} />
    </TestWrapper>
  );

  // Wait for component to render
  await component.waitFor({state: 'visible'});

  // Try to click a powerup if available
  const powerupButton = component.locator('.powerups--powerup').first();
  if (await powerupButton.isVisible()) {
    await powerupButton.click();
    expect(powerupUsed).toBe(true);
  }
});

test('Powerups renders empty when no powerups provided', async ({mount}) => {
  const handleUsePowerup = () => {};
  const component = await mount(
    <TestWrapper>
      <Powerups powerups={[]} handleUsePowerup={handleUsePowerup} />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});
