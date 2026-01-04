import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

export default [
  // Base JavaScript recommended rules
  js.configs.recommended,

  // Global ignores (must be in a separate object)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.config.js',
      '*.config.ts',
      'coverage/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '__tests__/**',
      '**/*.d.ts',
    ],
  },

  // TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json'],
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      import: importPlugin,
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.ts', '.json'],
          paths: ['../shared'],
        },
      },
    },
    rules: {
      // TypeScript ESLint recommended rules
      ...(typescript.configs?.recommended?.rules || {}),

      // TypeScript specific overrides
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-shadow': 'warn',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: null,
          trailingUnderscore: 'allow',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-expressions': ['error', {allowShortCircuit: true}],

      // Import rules
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-unresolved': [
        'error',
        {
          ignore: ['^@crosswithfriends/shared'],
        },
      ],
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          ts: 'never',
          js: 'always', // Required for ES modules in Node.js
          json: 'always',
        },
      ],
      'import/prefer-default-export': 'off',
      'import/no-default-export': 'off',
      'import/no-duplicates': 'error',
      'import/no-unused-modules': 'off', // Can be slow

      // General JavaScript/TypeScript rules
      'no-console': ['warn', {allow: ['warn', 'error']}],
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Use TypeScript version instead
      'no-underscore-dangle': ['warn', {allowAfterThis: true}],
      'no-plusplus': ['error', {allowForLoopAfterthoughts: true}],
      'no-param-reassign': ['warn', {props: false}],
      'no-nested-ternary': 'warn',
      'prefer-const': ['error', {destructuring: 'all'}],
      'prefer-destructuring': ['error', {array: false}],
      'consistent-return': 'warn',
      'class-methods-use-this': 'warn',
      'no-restricted-syntax': 'off',
      'no-unused-expressions': 'off', // Use TypeScript version instead
      'no-await-in-loop': 'warn',
      'require-await': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-throw-literal': 'error',
    },
  },

  // JavaScript files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-console': ['warn', {allow: ['warn', 'error']}],
      'no-debugger': 'error',
    },
  },

  // Prettier integration (must be last to override conflicting rules)
  ...(Array.isArray(prettier) ? prettier : [prettier]),
];
