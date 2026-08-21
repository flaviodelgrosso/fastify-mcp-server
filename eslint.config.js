import importX from 'eslint-plugin-import-x';
import neo, { resolveIgnoresFromGitignore } from 'neostandard';

export default [
  ...neo({
    ts: true,
    semi: true,
    ignores: resolveIgnoresFromGitignore()
  }),
  {
    plugins: {
      'import-x': importX
    },
    rules: {
      'import-x/order': [
        'warn',
        {
          'newlines-between': 'always',
          groups: ['builtin', 'internal', 'external', 'sibling', 'parent', 'index', 'type'],
          pathGroupsExcludedImportTypes: ['type'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          }
        }
      ]
    }
  }
];
