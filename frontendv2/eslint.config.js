/**
 * ESLint Configuration for Cross with Friends Frontend
 */

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
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
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // ==========================================
      // React Best Practices
      // ==========================================

      // Enforce React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Prevent missing key prop in JSX
      'react/jsx-key': [
        'error',
        {
          checkFragmentShorthand: true,
          checkKeyMustBeforeSpread: true,
        },
      ],

      // Prevent usage of dangerous JSX properties
      'react/no-danger': 'warn',
      'react/no-danger-with-children': 'error',

      // Prevent missing React when using JSX
      'react/react-in-jsx-scope': 'off', // Not needed in React 19

      // Prevent invalid HTML attribute
      'react/no-unknown-property': 'error',

      // Prevent usage of setState in componentDidMount
      'react/no-did-mount-set-state': 'warn',

      // Prevent direct mutation of this.state
      'react/no-direct-mutation-state': 'error',

      // Prevent usage of Array index in keys
      'react/no-array-index-key': 'warn',

      // Prevent missing displayName in a React component definition
      'react/display-name': 'off', // Allow anonymous components

      // Enforce consistent function type for function components
      'react/function-component-definition': [
        'error',
        {
          namedComponents: 'arrow-function',
          unnamedComponents: 'arrow-function',
        },
      ],

      // Prevent usage of button without type attribute
      'react/button-has-type': 'error',

      // Prevent void DOM elements from receiving children
      'react/void-dom-elements-no-children': 'error',

      // ==========================================
      // Accessibility Best Practices (WCAG 2.1 AA)
      // ==========================================

      // Require alt text on images
      'jsx-a11y/alt-text': [
        'error',
        {
          elements: ['img', 'object', 'area', 'input[type="image"]'],
        },
      ],

      // Enforce ARIA props are valid
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',

      // Enforce ARIA roles are valid
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',

      // Prevent redundant roles
      'jsx-a11y/no-redundant-roles': 'error',

      // Enforce anchor elements have content
      'jsx-a11y/anchor-has-content': 'error',

      // Enforce anchors are valid
      'jsx-a11y/anchor-is-valid': [
        'error',
        {
          aspects: ['invalidHref', 'preferButton'],
        },
      ],

      // Enforce click events have keyboard events
      'jsx-a11y/click-events-have-key-events': 'warn',

      // Enforce elements with onClick have role
      'jsx-a11y/no-static-element-interactions': 'warn',

      // Enforce keyboard accessibility
      'jsx-a11y/interactive-supports-focus': 'error',

      // Enforce labels on form elements
      'jsx-a11y/label-has-associated-control': [
        'error',
        {
          required: {
            some: ['nesting', 'id'],
          },
        },
      ],

      // Enforce lang attribute has valid value
      'jsx-a11y/lang': 'error',

      // Enforce media elements have captions
      'jsx-a11y/media-has-caption': 'warn',

      // Prevent autofocus
      'jsx-a11y/no-autofocus': ['warn', { ignoreNonDOM: true }],

      // Prevent positive tabIndex
      'jsx-a11y/tabindex-no-positive': 'error',

      // Enforce heading hierarchy
      'jsx-a11y/heading-has-content': 'error',

      // Enforce scope attribute is only used on th elements
      'jsx-a11y/scope': 'error',

      // ==========================================
      // TypeScript Best Practices
      // ==========================================

      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // ==========================================
      // Import Best Practices
      // ==========================================

      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/no-cycle': 'warn',
      'import/no-duplicates': 'error',

      // ==========================================
      // General Best Practices
      // ==========================================

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-nested-ternary': 'warn',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Ignore patterns
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'coverage/**',
      '.vite/**',
    ],
  },
];
