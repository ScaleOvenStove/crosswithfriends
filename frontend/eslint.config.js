const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const importPlugin = require('eslint-plugin-import');
const prettier = require('eslint-config-prettier');

module.exports = [
  // Base JavaScript recommended rules
  js.configs.recommended,

  // Global ignores (must be in a separate object)
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      '*.config.js',
      '*.config.ts',
      'coverage/**',
      '.vite/**',
      'public/**',
    ],
  },

  // TypeScript and TSX files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: ['./tsconfig.json'],
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        getComputedStyle: 'readonly',
        JSX: 'readonly',
        React: 'readonly',
        visualViewport: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
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
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
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
      '@typescript-eslint/no-unused-expressions': ['error', {allowShortCircuit: true}],

      // React recommended rules
      ...(react.configs?.recommended?.rules || {}),
      ...(reactHooks.configs?.recommended?.rules || {}),

      // React specific overrides
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': ['error', {skipUndeclared: true}],
      'react/jsx-filename-extension': ['error', {extensions: ['.tsx']}],
      'react/jsx-props-no-spreading': 'warn',
      'react/jsx-no-bind': 'warn',
      'react/jsx-no-useless-fragment': 'error',
      'react/no-array-index-key': 'warn',
      'react/button-has-type': 'off',
      'react/sort-comp': 'off',
      'react/destructuring-assignment': 'off',
      'react/jsx-one-expression-per-line': 'off',
      'react/require-default-props': 'off', // Not needed with TypeScript
      'react/no-unused-prop-types': 'off', // Not needed with TypeScript

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'off', // Can cause false positives with React Compiler
      'react-hooks/refs': 'warn', // Can be too strict
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',

      // JSX A11y recommended rules
      ...(jsxA11y.configs?.recommended?.rules || {}),

      // JSX A11y overrides
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'warn',
      'jsx-a11y/no-noninteractive-tabindex': 'warn',
      'jsx-a11y/tabindex-no-positive': 'warn',

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
      'import/no-unresolved': 'error',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          ts: 'never',
          tsx: 'never',
          js: 'never',
          jsx: 'never',
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
    },
  },

  // JavaScript and JSX files
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        getComputedStyle: 'readonly',
        JSX: 'readonly',
        React: 'readonly',
        visualViewport: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...(react.configs?.recommended?.rules || {}),
      ...(reactHooks.configs?.recommended?.rules || {}),
      'react/react-in-jsx-scope': 'off',
    },
  },

  // Prettier integration (must be last to override conflicting rules)
  ...(Array.isArray(prettier) ? prettier : [prettier]),
];
