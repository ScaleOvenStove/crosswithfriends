import {describe, it, expect} from 'vitest';
import {isFBMessengerCrawler, isLinkExpanderBot} from '../../utils/link_preview_util.js';

describe('Link Preview Utilities', () => {
  describe('isFBMessengerCrawler', () => {
    it('should return true for Facebook Messenger user agent', () => {
      const userAgent = 'Mozilla/5.0 (compatible; facebookexternalhit/1.1)';
      expect(isFBMessengerCrawler(userAgent)).toBe(true);
    });

    it('should return true for Facebook Messenger user agent with additional text', () => {
      const userAgent =
        'Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)';
      expect(isFBMessengerCrawler(userAgent)).toBe(true);
    });

    it('should return false for non-Facebook user agent', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      expect(isFBMessengerCrawler(userAgent)).toBe(false);
    });

    it('should return false for Discord bot user agent', () => {
      const userAgent = 'Discordbot/2.0';
      expect(isFBMessengerCrawler(userAgent)).toBe(false);
    });

    it('should return false for Slack bot user agent', () => {
      const userAgent = 'Slackbot-LinkExpanding 1.0';
      expect(isFBMessengerCrawler(userAgent)).toBe(false);
    });

    it('should return false for undefined user agent', () => {
      expect(isFBMessengerCrawler(undefined)).toBe(false);
    });

    it('should return false for empty string user agent', () => {
      expect(isFBMessengerCrawler('')).toBe(false);
    });

    it('should return true for partial match of facebookexternalhit', () => {
      const userAgent = 'facebookexternalhit';
      expect(isFBMessengerCrawler(userAgent)).toBe(true);
    });

    it('should return false for partial match without full substring', () => {
      const userAgent = 'facebookexternal';
      expect(isFBMessengerCrawler(userAgent)).toBe(false);
    });

    it('should be case sensitive', () => {
      const userAgent = 'FACEBOOKEXTERNALHIT';
      expect(isFBMessengerCrawler(userAgent)).toBe(false);
    });
  });

  describe('isLinkExpanderBot', () => {
    it('should return true for Discord bot user agent', () => {
      const userAgent = 'Discordbot/2.0';
      expect(isLinkExpanderBot(userAgent)).toBe(true);
    });

    it('should return true for Slack bot user agent', () => {
      const userAgent = 'Slackbot-LinkExpanding 1.0';
      expect(isLinkExpanderBot(userAgent)).toBe(true);
    });

    it('should return true for Facebook Messenger user agent', () => {
      const userAgent = 'Mozilla/5.0 (compatible; facebookexternalhit/1.1)';
      expect(isLinkExpanderBot(userAgent)).toBe(true);
    });

    it('should return true for any of the link expander bots', () => {
      const userAgents = ['Discordbot/2.0', 'Slackbot-LinkExpanding 1.0', 'facebookexternalhit/1.1'];

      userAgents.forEach((ua) => {
        expect(isLinkExpanderBot(ua)).toBe(true);
      });
    });

    it('should return false for regular browser user agent', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      expect(isLinkExpanderBot(userAgent)).toBe(false);
    });

    it('should return false for undefined user agent', () => {
      expect(isLinkExpanderBot(undefined)).toBe(false);
    });

    it('should return false for empty string user agent', () => {
      expect(isLinkExpanderBot('')).toBe(false);
    });

    it('should return false for non-bot user agent', () => {
      const userAgent = 'curl/7.68.0';
      expect(isLinkExpanderBot(userAgent)).toBe(false);
    });

    it('should handle partial matches correctly', () => {
      // These should match because includes() matches substrings
      expect(isLinkExpanderBot('Discordbot')).toBe(true);
      expect(isLinkExpanderBot('Slackbot-LinkExpanding')).toBe(true);
      expect(isLinkExpanderBot('facebookexternalhit')).toBe(true);
    });

    it('should be case sensitive', () => {
      expect(isLinkExpanderBot('DISCORDBOT')).toBe(false);
      expect(isLinkExpanderBot('SLACKBOT-LINKEXPANDING')).toBe(false);
      expect(isLinkExpanderBot('FACEBOOKEXTERNALHIT')).toBe(false);
    });
  });
});
