import {test, expect} from '@playwright/experimental-ct-react';

import Clock from '../../../components/Toolbar/Clock';
import {TestWrapper} from '../../utils';

test('Clock renders with default time', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Clock />
    </TestWrapper>
  );

  await expect(component.locator('.clock')).toBeVisible();
  await expect(component.locator('.clock')).toContainText('00:00');
});

test('Clock displays paused time when paused', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <Clock pausedTime={5000} isPaused />
    </TestWrapper>
  );

  await expect(component.locator('.clock')).toBeVisible();
  // Should show time in parentheses when paused
  await expect(component.locator('.clock')).toContainText('(');
});

test('Clock calls onStart when clicked while paused', async ({mount}) => {
  let started = false;
  const onStart = () => {
    started = true;
  };

  const component = await mount(
    <TestWrapper>
      <Clock isPaused onStart={onStart} />
    </TestWrapper>
  );

  await component.locator('.clock').click();
  expect(started).toBe(true);
});

test('Clock calls onPause when clicked while running', async ({mount}) => {
  let paused = false;
  const onPause = () => {
    paused = true;
  };

  const component = await mount(
    <TestWrapper>
      <Clock isPaused={false} onPause={onPause} />
    </TestWrapper>
  );

  await component.locator('.clock').click();
  expect(paused).toBe(true);
});

test('Clock shows correct time with startTime', async ({mount}) => {
  const startTime = Date.now() - 5000; // 5 seconds ago
  const component = await mount(
    <TestWrapper>
      <Clock startTime={startTime} />
    </TestWrapper>
  );

  await expect(component.locator('.clock')).toBeVisible();
  // Should show approximately 5 seconds
  const text = await component.locator('.clock').textContent();
  expect(text).toContain('00:05');
});
