import {test, expect} from '@playwright/experimental-ct-react';
import React from 'react';

import MobilePanel from '../../../components/common/MobilePanel';
import {TestWrapper} from '../../utils';

test('MobilePanel renders', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <MobilePanel />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});
