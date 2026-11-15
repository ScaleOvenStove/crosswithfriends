import {vi} from 'vitest';
import {act, createElement} from 'react';
import {createRoot} from 'react-dom/client';
import GridControls from '../GridControls';
import {makeDefaultProps} from '../testHelpers';

window.IS_REACT_ACT_ENVIRONMENT = true;

it('relays IME input typed into the hidden input', async () => {
  vi.useFakeTimers();
  const props = makeDefaultProps();
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  await act(async () => root.render(createElement(GridControls, props)));
  const input = div.querySelector('input[name="grid"]');
  input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Process', keyCode: 229, bubbles: true}));
  input.value = 'f';
  input.dispatchEvent(new InputEvent('input', {data: 'f', bubbles: true}));
  vi.runAllTimers();
  expect(props.updateGrid).toHaveBeenCalledWith(0, 0, 'F');
  expect(input.value).toBe('');

  input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Process', keyCode: 229, bubbles: true}));
  input.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
  input.value = 'k';
  input.dispatchEvent(new InputEvent('input', {data: 'k', isComposing: true, bubbles: true}));
  expect(input.value).toBe('k');
  input.dispatchEvent(new CompositionEvent('compositionend', {data: 'k', bubbles: true}));
  vi.runAllTimers();
  expect(props.updateGrid).toHaveBeenLastCalledWith(0, 0, 'K');
  expect(input.value).toBe('');
  act(() => root.unmount());
  vi.useRealTimers();
});
