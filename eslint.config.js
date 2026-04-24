// Minimal ESLint config — focused on real bugs, not style.
//
// Style rules (indentation, quote style, semicolons, etc.) are deliberately
// disabled: the repo has never been linted and a style sweep across 7k+
// lines would drown out the bug signal. Add stricter rules incrementally.

import js from '@eslint/js';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      '**/*.broken.js',
      '**/*.backup.js',
      '**/*.bak',
      // HTML files contain large inline <script> blocks; lint those
      // separately once there's a plan for admin.html / profile.html.
      '*.html',
      'assets/**',
      // Tailwind output
      'assets/css/tailwind.css',
    ],
  },

  // Backend worker + scripts
  {
    files: ['backend/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        // Cloudflare Workers runtime globals (subset we actually use).
        crypto: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,

      // Keep bug-catching rules; silence style/noise for this pass.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^e$|^err$|^error$',
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-prototype-builtins': 'off',
      'no-inner-declarations': 'off',
      'no-useless-escape': 'warn',
      'no-case-declarations': 'off',

      // Bug-class rules stay on:
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-func-assign': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },

  // Test files
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        crypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
];
