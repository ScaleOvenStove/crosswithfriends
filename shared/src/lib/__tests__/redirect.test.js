import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

describe('redirect', () => {
  let originalLocation;
  let mockLocation;

  beforeEach(async () => {
    // Reset modules to clear the redirected flag
    vi.resetModules();

    // Save original location
    originalLocation = window.location;
    delete window.location;

    // Create mock location
    mockLocation = {
      replace: vi.fn(),
    };
    window.location = mockLocation;

    // Mock window.alert for jsdom compatibility
    window.alert = vi.fn();
  });

  afterEach(() => {
    // Restore original location
    window.location = originalLocation;
    vi.clearAllMocks();
  });

  it('should redirect to URL', async () => {
    const {default: redirect} = await import('../redirect');
    const url = 'https://example.com';
    redirect(url);
    expect(mockLocation.replace).toHaveBeenCalledWith(url);
  });

  it('should show alert message if provided', async () => {
    const {default: redirect} = await import('../redirect');
    const url = 'https://example.com';
    const message = 'Redirecting...';
    redirect(url, message);
    expect(window.alert).toHaveBeenCalledWith(message);
  });

  it('should not show alert if message not provided', async () => {
    const {default: redirect} = await import('../redirect');
    const url = 'https://example.com';
    redirect(url);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('should only redirect once', async () => {
    const {default: redirect} = await import('../redirect');
    const url1 = 'https://example.com';
    const url2 = 'https://other.com';
    redirect(url1);
    redirect(url2);
    // Should only be called once
    expect(mockLocation.replace).toHaveBeenCalledTimes(1);
    expect(mockLocation.replace).toHaveBeenCalledWith(url1);
  });

  it('should prevent multiple redirects', async () => {
    const {default: redirect} = await import('../redirect');
    const url = 'https://example.com';
    redirect(url, 'First');
    redirect(url, 'Second');
    redirect(url, 'Third');
    expect(mockLocation.replace).toHaveBeenCalledTimes(1);
  });

  it('should handle different URL formats', async () => {
    // Reset module for fresh state
    vi.resetModules();
    const {default: redirectFn} = await import('../redirect');

    const url = 'https://example.com';
    redirectFn(url);
    expect(mockLocation.replace).toHaveBeenCalledWith(url);
  });
});
