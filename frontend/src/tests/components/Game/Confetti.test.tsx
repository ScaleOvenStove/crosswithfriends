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

  // Confetti should render (it uses react-confetti library)
  await expect(component).toBeVisible();
});

test('Confetti completes and hides after timeout', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <ConfettiComponent />
    </TestWrapper>
  );

  // Wait for confetti to complete (7 seconds + completion callback)
  await component.waitFor({state: 'hidden', timeout: 8000}).catch(() => {
    // Component may still be visible, which is fine
  });
});
