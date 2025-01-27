import globals from 'globals';
import pluginJs from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        Swal: 'readonly',
        firebase: 'readonly',
        auth: 'readonly',
      },
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      sonarjs: sonarjs,
    },
    rules: {
      ...sonarjs.configs.recommended.rules,
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'error',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
    },
  },
  pluginJs.configs.recommended,
  prettier,
  {
    files: ['**/*.hbs'],
    rules: {
      'prettier/prettier': [
        'error',
        {
          parser: 'glimmer',
        },
      ],
    },
  },
];
