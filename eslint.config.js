import neo, { resolveIgnoresFromGitignore, plugins } from 'neostandard';

const stylisticRules = plugins['@stylistic'].configs['all-flat'];

export default [
  ...neo({
    ts: true,
    semi: true,
    ignores: resolveIgnoresFromGitignore()
  }),
  stylisticRules,
  {
    rules: {
      '@stylistic/semi': [
        'warn',
        'always'
      ],
      '@stylistic/multiline-comment-style': 'warn',
      '@stylistic/function-call-argument-newline': 'off',
      '@stylistic/lines-around-comment': 'off',
      '@stylistic/comma-dangle': [
        'error',
        {
          arrays: 'never',
          objects: 'never',
          imports: 'never',
          exports: 'never',
          functions: 'never'
        }
      ],
      'import-x/order': [
        'warn',
        {
          'newlines-between': 'always',
          groups: [
            'builtin',
            'internal',
            'external',
            'sibling',
            'parent',
            'index'
          ],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          }
        }
      ]

    }
  }
];
