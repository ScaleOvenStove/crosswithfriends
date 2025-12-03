/**
 * OpenAPI schemas for auto-generated documentation
 * These schemas define the structure of requests and responses
 */

export const HealthResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp', 'uptime'],
  properties: {
    status: {type: 'string'},
    timestamp: {type: 'string', format: 'date-time', description: 'ISO 8601 format timestamp'},
    uptime: {type: 'number', description: 'Process uptime in seconds'},
  },
} as const;

export const CreateGameRequestSchema = {
  type: 'object',
  required: ['gid', 'pid'],
  properties: {
    gid: {type: 'string', description: 'Game ID'},
    pid: {type: 'string', description: 'Puzzle ID'},
  },
} as const;

export const CreateGameResponseSchema = {
  type: 'object',
  required: ['gid'],
  properties: {
    gid: {type: 'string', description: 'Game ID'},
  },
} as const;

export const GetGameResponseSchema = {
  type: 'object',
  required: ['gid', 'pid', 'title', 'author', 'duration', 'size'],
  properties: {
    gid: {type: 'string', description: 'Game ID'},
    pid: {type: 'string', description: 'Puzzle ID'},
    title: {type: 'string', description: 'Puzzle title'},
    author: {type: 'string', description: 'Puzzle author'},
    duration: {type: 'number', description: 'Time taken to solve in seconds'},
    size: {type: 'string', description: 'Puzzle size'},
  },
} as const;

export const PuzzleJsonSchema = {
  type: 'object',
  // Allow additional properties to support legacy format fields (grid, info, etc.)
  additionalProperties: true,
  // Only require clues since both formats have that
  required: ['clues'],
  properties: {
    // New format (ipuz) fields
    version: {type: 'string', description: 'IPuz version'},
    kind: {
      type: 'array',
      items: {type: 'string'},
      description: 'IPuz kind',
    },
    dimensions: {
      type: 'object',
      properties: {
        width: {type: 'number', description: 'Puzzle width'},
        height: {type: 'number', description: 'Puzzle height'},
      },
    },
    title: {type: 'string', description: 'Puzzle title'},
    author: {type: 'string', description: 'Puzzle author'},
    copyright: {type: 'string', description: 'Copyright information'},
    notes: {type: 'string', description: 'Puzzle description/notes'},
    solution: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          oneOf: [{type: 'string'}, {type: 'null'}],
        },
      },
      description: 'Solution grid (new format)',
    },
    puzzle: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          oneOf: [{type: 'string'}, {type: 'object'}, {type: 'null'}],
        },
      },
      description: 'Puzzle grid (new format)',
    },
    clues: {
      type: 'object',
      additionalProperties: true,
      properties: {
        Across: {
          type: 'array',
          items: {
            oneOf: [{type: 'string'}, {type: 'object'}, {type: 'null'}],
          },
          description: 'Across clues',
        },
        Down: {
          type: 'array',
          items: {
            oneOf: [{type: 'string'}, {type: 'object'}, {type: 'null'}],
          },
          description: 'Down clues',
        },
      },
    },
    // Legacy format fields explicitly defined
    grid: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          oneOf: [{type: 'string'}, {type: 'null'}],
        },
      },
      description: 'Legacy format: Solution grid',
    },
    info: {
      type: 'object',
      additionalProperties: true,
      properties: {
        type: {type: 'string', description: 'Puzzle type'},
        title: {type: 'string', description: 'Puzzle title'},
        author: {type: 'string', description: 'Puzzle author'},
        description: {type: 'string', description: 'Puzzle description'},
      },
      description: 'Legacy format: Puzzle metadata',
    },
  },
} as const;

export const AddPuzzleRequestSchema = {
  type: 'object',
  required: ['puzzle', 'isPublic'],
  properties: {
    puzzle: PuzzleJsonSchema,
    pid: {type: 'string', description: 'Optional puzzle ID'},
    isPublic: {type: 'boolean', description: 'Whether the puzzle is public'},
  },
} as const;

export const AddPuzzleResponseSchema = {
  type: 'object',
  required: ['pid'],
  properties: {
    pid: {type: 'string', description: 'Puzzle ID'},
  },
} as const;

export const RecordSolveRequestSchema = {
  type: 'object',
  required: ['gid', 'time_to_solve'],
  properties: {
    gid: {type: 'string', description: 'Game ID'},
    time_to_solve: {type: 'number', description: 'Time taken to solve in seconds'},
  },
} as const;

export const RecordSolveResponseSchema = {
  type: 'object',
  description: 'Empty response object',
} as const;

export const IncrementGidResponseSchema = {
  type: 'object',
  required: ['gid'],
  properties: {
    gid: {type: 'string', description: 'New game ID'},
  },
} as const;

export const IncrementPidResponseSchema = {
  type: 'object',
  required: ['pid'],
  properties: {
    pid: {type: 'string', description: 'New puzzle ID'},
  },
} as const;

export const ErrorResponseSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: {
    error: {type: 'string', description: 'Error type'},
    message: {type: 'string', description: 'Error message'},
    statusCode: {type: 'number', description: 'HTTP status code'},
    retryAfter: {type: 'number', description: 'Retry after seconds (for rate limiting)'},
  },
} as const;

export const ListPuzzleStatsRequestSchema = {
  type: 'object',
  required: ['gids'],
  properties: {
    gids: {
      type: 'array',
      items: {type: 'string'},
      description: 'Array of game IDs',
    },
  },
} as const;

export const OEmbedResponseSchema = {
  type: 'object',
  required: ['type', 'version', 'author_name'],
  properties: {
    type: {type: 'string'},
    version: {type: 'string'},
    author_name: {type: 'string', description: 'Author name'},
  },
} as const;
