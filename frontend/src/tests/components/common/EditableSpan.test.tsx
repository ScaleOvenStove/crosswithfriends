import {test, expect} from '@playwright/experimental-ct-react';
import React, {useRef} from 'react';

import EditableSpan from '../../../components/common/EditableSpan';
import type {EditableSpanRef} from '../../../components/common/EditableSpan';
import {TestWrapper} from '../../utils';

test('EditableSpan renders with initial value', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <EditableSpan value="Test value" onChange={() => {}} />
    </TestWrapper>
  );

  await expect(component.locator('[contenteditable="true"]')).toContainText('Test value');
});

test('EditableSpan displays (blank) when value is empty', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <EditableSpan value="" onChange={() => {}} />
    </TestWrapper>
  );

  await expect(component.locator('[contenteditable="true"]')).toContainText('(blank)');
});

test('EditableSpan is hidden when hidden prop is true', async ({mount}) => {
  const component = await mount(
    <TestWrapper>
      <EditableSpan value="Test" onChange={() => {}} hidden />
    </TestWrapper>
  );

  await expect(component).not.toBeVisible();
});

test('EditableSpan calls onChange on Enter key', async ({mount}) => {
  let changedValue = '';
  const handleChange = (value: string) => {
    changedValue = value;
  };

  const component = await mount(
    <TestWrapper>
      <EditableSpan value="Initial" onChange={handleChange} />
    </TestWrapper>
  );

  const editable = component.locator('[contenteditable="true"]');
  await editable.click();
  await editable.fill('New value');
  await editable.press('Enter');

  // Wait for debounced onChange
  await new Promise((resolve) => setTimeout(resolve, 600));
  expect(changedValue).toBe('New value');
});

test('EditableSpan calls onChange on Escape key', async ({mount}) => {
  let changedValue = '';
  const handleChange = (value: string) => {
    changedValue = value;
  };

  const component = await mount(
    <TestWrapper>
      <EditableSpan value="Initial" onChange={handleChange} />
    </TestWrapper>
  );

  const editable = component.locator('[contenteditable="true"]');
  await editable.click();
  await editable.fill('New value');
  await editable.press('Escape');

  // Wait for debounced onChange
  await new Promise((resolve) => setTimeout(resolve, 600));
  expect(changedValue).toBe('New value');
});

test('EditableSpan focus method works via ref', async ({mount}) => {
  const TestComponent = () => {
    const ref = useRef<EditableSpanRef>(null);
    return (
      <>
        <EditableSpan ref={ref} value="Test" onChange={() => {}} />
        <button onClick={() => ref.current?.focus()}>Focus</button>
      </>
    );
  };

  const component = await mount(
    <TestWrapper>
      <TestComponent />
    </TestWrapper>
  );

  const editable = component.locator('[contenteditable="true"]');
  await component.locator('button:has-text("Focus")').click();

  // Check if element is focused
  await expect(editable).toBeFocused();
});

test('EditableSpan calls onBlur when blurred', async ({mount}) => {
  let blurCalled = false;
  const handleBlur = () => {
    blurCalled = true;
  };

  const component = await mount(
    <TestWrapper>
      <EditableSpan value="Test" onChange={() => {}} onBlur={handleBlur} />
    </TestWrapper>
  );

  const editable = component.locator('[contenteditable="true"]');
  await editable.click();
  await editable.blur();

  expect(blurCalled).toBe(true);
});
