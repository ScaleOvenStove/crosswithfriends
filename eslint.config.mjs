import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // ── Global ignores (replaces .eslintignore) ──
  {
    ignores: [
      'backfills/',
      'build/',
      'e2e/',
      'utils/',
      'jest.config.server.js',
      'middleware.ts',
      'prettier.config.js',
    ],
  },

  // ── Base configs ──
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  jsxA11y.flatConfigs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,

  // ── Language, globals & settings ──
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {},
      },
    },
  },

  // ── Test globals ──
  {
    files: ['src/**/__tests__/**/*.{js,jsx,ts,tsx}', 'src/**/*.test.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
  {
    files: ['server/**/__tests__/**/*.{js,ts}', 'server/**/*.test.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  // ── Custom rules ──
  {
    rules: {
      // Disabled — not wanted or not applicable
      'no-return-await': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      'import/extensions': 'off',
      'react/jsx-filename-extension': 'off',
      'react/button-has-type': 'off',
      'react/sort-comp': 'off',
      'import/prefer-default-export': 'off',
      'react/destructuring-assignment': 'off',
      'no-restricted-syntax': 'off',
      'react/jsx-one-expression-per-line': 'off',

      // Previously "warn", promoted to "error" (0 current violations)
      'class-methods-use-this': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/mouse-events-have-key-events': 'error',
      '@typescript-eslint/no-shadow': 'error',
      'consistent-return': 'error',
      'no-param-reassign': ['error', {props: false}],
      'react/jsx-no-bind': 'error',
      'no-nested-ternary': 'error',
      'jsx-a11y/no-noninteractive-tabindex': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
      'react/jsx-props-no-spreading': 'error',
      'react/no-array-index-key': 'error',
      'no-underscore-dangle': ['error', {allowAfterThis: true}],

      // Custom error configs
      'react/prop-types': ['error', {skipUndeclared: true}],
      '@typescript-eslint/naming-convention': [
        'error',
        {selector: 'default', format: null, trailingUnderscore: 'allow'},
      ],
      'no-plusplus': ['error', {allowForLoopAfterthoughts: true}],
      'prefer-destructuring': ['error', {array: false}],
      '@typescript-eslint/no-unused-expressions': ['error', {allowShortCircuit: true}],
      'prefer-const': ['error', {destructuring: 'all'}],

      // Disable base rules in favor of @typescript-eslint versions
      'no-shadow': 'off',
      'no-unused-vars': 'off',

      // Configure @typescript-eslint/no-unused-vars to match codebase patterns
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // New recommended rules relaxed for this codebase
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',

      // Import rules
      'import/no-named-as-default-member': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/__tests__/**',
            '**/__mocks__/**',
            '**/*.test.{js,jsx,ts,tsx}',
            '**/*.spec.{js,jsx,ts,tsx}',
            '**/vite.config.ts',
            '**/vitest.config.ts',
            '**/eslint.config.mjs',
            '**/jest.config.server.js',
          ],
          optionalDependencies: false,
        },
      ],
    },
  },

  // ── Prettier (must be last) ──
  prettier,
);
