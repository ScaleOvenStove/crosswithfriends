import {test, expect} from '@playwright/experimental-ct-react';
import React, {useRef} from 'react';

import ChatBar from '../../../components/Chat/ChatBar';
import type {ChatBarRef} from '../../../components/Chat/ChatBar';
import {TestWrapper} from '../../utils';

test('ChatBar renders', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <ChatBar onSendMessage={() => {}} onUnfocus={() => {}} />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});

test('ChatBar calls onSendMessage when message is sent', async ({mount}) => {
  let messageSent = '';
  const onSendMessage = (message: string) => {
    messageSent = message;
  };

  const component = await mount(
    <TestWrapper>
      <ChatBar onSendMessage={onSendMessage} onUnfocus={() => {}} />
    </TestWrapper>
  );

  const input = component.locator('input');
  await input.fill('Test message');
  await input.press('Enter');

  expect(messageSent).toBe('Test message');
});

test('ChatBar focus method works via ref', async ({mount}) => {
  const TestComponent = () => {
    const ref = useRef<ChatBarRef>(null);
    return (
      <>
        <ChatBar ref={ref} onSendMessage={() => {}} onUnfocus={() => {}} />
        <button onClick={() => ref.current?.focus()}>Focus</button>
      </>
    );
  };

  const component = await mount(
    <TestWrapper>
      <TestComponent />
    </TestWrapper>
  );

  const input = component.locator('input');
  await component.locator('button:has-text("Focus")').click();

  await expect(input).toBeFocused();
});

test('ChatBar renders with mobile prop', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <ChatBar mobile onSendMessage={() => {}} onUnfocus={() => {}} />
    </TestWrapper>
  );

  await expect(component).toBeVisible();
});
