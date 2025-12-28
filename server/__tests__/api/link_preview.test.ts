import {describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';

// Mock the utility functions
const mockIsLinkExpanderBot = vi.fn((ua: string) => ua === 'bot' || ua === 'messenger');
const mockIsFBMessengerCrawler = vi.fn((ua: string) => ua === 'messenger');

vi.mock('../../utils/link_preview_util.js', () => ({
  isLinkExpanderBot: (ua: string) => mockIsLinkExpanderBot(ua),
  isFBMessengerCrawler: (ua: string) => mockIsFBMessengerCrawler(ua),
}));

describe('Link Preview API', () => {
  let app: FastifyInstance & {
    repositories: {
      game: {
        getInfo: Mock;
      };
    };
    services: {
      puzzle: {
        getPuzzleInfo: Mock;
      };
    };
  };

  beforeAll(async () => {
    app = (await buildTestApp()) as typeof app;
    await waitForApp(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock functions to default behavior
    mockIsLinkExpanderBot.mockImplementation((ua: string) => ua === 'bot' || ua === 'messenger');
    mockIsFBMessengerCrawler.mockImplementation((ua: string) => ua === 'messenger');
  });

  describe('GET /api/link_preview', () => {
    it('should return 400 for invalid URL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/link_preview?url=not-a-valid-url',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('Invalid URL format');
    });

    it('should return 400 for invalid URL path', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/link_preview?url=https://example.com/invalid/path',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('Invalid URL path');
    });

    it('should redirect non-bot user agents', async () => {
      const mockUrl = 'https://example.com/game/test-gid';
      const mockGameInfo = {
        title: 'Test Game',
        author: 'Test Author',
        description: 'Test Description',
      };

      app.repositories.game.getInfo.mockResolvedValue(mockGameInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(mockUrl);
    });

    it('should return HTML for bot user agents with game info', async () => {
      const mockUrl = 'https://example.com/game/test-gid';
      const mockGameInfo = {
        title: 'Test Game',
        author: 'Test Author',
        description: 'Test Description',
      };

      app.repositories.game.getInfo.mockResolvedValue(mockGameInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        headers: {
          'user-agent': 'bot',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('Test Game');
      // Author is not in the HTML body (OGP doesn't support it), but should be in oembed link
      expect(response.body).toContain('Test%20Author'); // URL encoded in oembed link
      expect(response.body).toContain('Test Description');
    });

    it('should return HTML for bot user agents with puzzle info', async () => {
      const mockUrl = 'https://example.com/play/test-pid';
      const mockPuzzleInfo = {
        title: 'Test Puzzle',
        author: 'Puzzle Author',
        description: 'Puzzle Description',
      };

      app.services.puzzle.getPuzzleInfo.mockResolvedValue(mockPuzzleInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        headers: {
          'user-agent': 'bot',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('Test Puzzle');
    });

    it('should return 404 when game/puzzle not found', async () => {
      const mockUrl = 'https://example.com/game/nonexistent';

      app.repositories.game.getInfo.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        headers: {
          'user-agent': 'bot',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('Game or puzzle not found');
    });

    it('should return HTML for FBMessenger crawler with different title format', async () => {
      const mockUrl = 'https://example.com/game/test-gid';
      const mockGameInfo = {
        title: 'Test Game',
        author: 'Test Author',
        description: 'Test Description',
      };

      mockIsLinkExpanderBot.mockReturnValue(true);
      mockIsFBMessengerCrawler.mockReturnValue(true);
      app.repositories.game.getInfo.mockResolvedValue(mockGameInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        headers: {
          'user-agent': 'messenger',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      // Messenger format: title | author | description
      expect(response.body).toContain('Test Game | Test Author | Test Description');
    });

    it('should handle missing user-agent header', async () => {
      const mockUrl = 'https://example.com/game/test-gid';
      const mockGameInfo = {
        title: 'Test Game',
        author: 'Test Author',
        description: 'Test Description',
      };

      mockIsLinkExpanderBot.mockReturnValue(false);
      app.repositories.game.getInfo.mockResolvedValue(mockGameInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        // No user-agent header
      });

      // Should redirect when user-agent is missing (treated as non-bot)
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(mockUrl);
    });

    it('should handle empty info object', async () => {
      const mockUrl = 'https://example.com/game/test-gid';

      mockIsLinkExpanderBot.mockReturnValue(true);
      app.repositories.game.getInfo.mockResolvedValue({});

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        headers: {
          'user-agent': 'bot',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('Game or puzzle not found');
    });

    it('should verify oembed endpoint URL construction', async () => {
      const mockUrl = 'https://example.com/game/test-gid';
      const mockGameInfo = {
        title: 'Test Game',
        author: 'Test Author',
        description: 'Test Description',
      };

      mockIsLinkExpanderBot.mockReturnValue(true);
      app.repositories.game.getInfo.mockResolvedValue(mockGameInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        headers: {
          'user-agent': 'bot',
          host: 'test.example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      // Verify oembed link is present in HTML
      expect(response.body).toContain('application/json+oembed');
      expect(response.body).toContain('/api/oembed?author=');
      expect(response.body).toContain('Test%20Author'); // URL encoded author
    });

    it('should handle puzzle URL with play path', async () => {
      const mockUrl = 'https://example.com/play/test-pid';
      const mockPuzzleInfo = {
        title: 'Test Puzzle',
        author: 'Puzzle Author',
        description: 'Puzzle Description',
      };

      mockIsLinkExpanderBot.mockReturnValue(true);
      app.services.puzzle.getPuzzleInfo.mockResolvedValue(mockPuzzleInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/link_preview?url=${encodeURIComponent(mockUrl)}`,
        headers: {
          'user-agent': 'bot',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('Test Puzzle');
      expect(response.body).toContain('Puzzle%20Author');
    });
  });
});
