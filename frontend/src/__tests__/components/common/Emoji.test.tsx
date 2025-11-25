import {screen} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import Emoji from '../../../components/common/Emoji';

// Mock emoji library
vi.mock('@crosswithfriends/shared/lib/emoji', () => ({
  get: vi.fn((emoji: string) => {
    if (emoji === 'smile') {
      return {url: 'https://example.com/smile.png'};
    }
    if (emoji === 'heart') {
      return '❤️';
    }
    return null;
  }),
}));

import {renderWithProviders} from '../../utils';

describe('Emoji', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render emoji with URL as image', () => {
    renderWithProviders(<Emoji emoji="smile" />);

    const img = screen.getByAltText('smile');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/smile.png');
  });

  it('should render emoji without URL as text', () => {
    renderWithProviders(<Emoji emoji="heart" />);

    const span = screen.getByTitle('heart');
    expect(span).toBeInTheDocument();
    expect(span).toHaveTextContent('❤️');
  });

  it('should return null for invalid emoji', () => {
    const {container} = renderWithProviders(<Emoji emoji="invalid" />);

    expect(container.firstChild).toBeNull();
  });

  it('should render big emoji with larger size', () => {
    renderWithProviders(<Emoji emoji="smile" big />);

    const img = screen.getByAltText('smile');
    expect(img).toHaveStyle({height: '60px'});
  });

  it('should render normal size emoji by default', () => {
    renderWithProviders(<Emoji emoji="smile" />);

    const img = screen.getByAltText('smile');
    expect(img).toHaveStyle({height: '22px'});
  });

  it('should apply custom className', () => {
    renderWithProviders(<Emoji emoji="smile" className="custom-class" />);

    const span = screen.getByTitle('smile');
    expect(span).toHaveClass('custom-class');
  });
});
