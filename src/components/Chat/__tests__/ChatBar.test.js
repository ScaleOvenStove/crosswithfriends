import {act} from 'react';
import {createRoot} from 'react-dom/client';
import ChatBar from '../ChatBar';

window.IS_REACT_ACT_ENVIRONMENT = true;

describe('ChatBar', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderBar = ({mobile}) => {
    const onSendMessage = vi.fn();
    const onUnfocus = vi.fn();
    act(() => {
      root.render(<ChatBar mobile={mobile} onSendMessage={onSendMessage} onUnfocus={onUnfocus} />);
    });
    const input = container.querySelector('input');
    return {input, onSendMessage, onUnfocus};
  };

  const typeAndSend = (input, text) => {
    act(() => input.focus());
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, text);
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    });
  };

  it('dismisses the keyboard after sending on mobile', () => {
    const {input, onSendMessage} = renderBar({mobile: true});
    typeAndSend(input, 'got 17A');
    expect(onSendMessage).toHaveBeenCalledWith('got 17A');
    expect(input.value).toBe('');
    expect(document.activeElement).not.toBe(input);
  });

  it('keeps focus after sending on desktop so more messages can follow', () => {
    const {input, onSendMessage} = renderBar({mobile: false});
    typeAndSend(input, 'hello');
    expect(onSendMessage).toHaveBeenCalledWith('hello');
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('unfocuses chat when Enter is pressed on an empty input', () => {
    const {input, onSendMessage, onUnfocus} = renderBar({mobile: true});
    typeAndSend(input, '');
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(onUnfocus).toHaveBeenCalled();
  });
});
