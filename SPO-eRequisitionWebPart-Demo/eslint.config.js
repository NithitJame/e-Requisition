const spfxProfile = require('@microsoft/eslint-config-spfx/lib/flat-profiles/react');
const boundaries = require('eslint-plugin-boundaries');

module.exports = [
  ...spfxProfile,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.json'
      }
    }
  },
  // ── Layer boundary enforcement (CLAUDE.md §7) ────────────────────────────
  // Enforces the folder-structure dependency rules from CLAUDE.md §2:
  //   app → may import app / feature / shared
  //   feature → may import shared + its OWN feature (never another feature)
  //   shared → may import shared only (guards against circular deps)
  // Scoped to the layered source under the SPFx web part; the web part entry
  // point (RequisitionWebPart.ts) counts as the "app" layer. `loc/`, data JSON,
  // and generated typings sit outside the layers and are intentionally excluded.
  {
    files: [
      'src/webparts/requisition/app/**/*.{ts,tsx}',
      'src/webparts/requisition/features/**/*.{ts,tsx}',
      'src/webparts/requisition/shared/**/*.{ts,tsx}',
      'src/webparts/requisition/RequisitionWebPart.ts'
    ],
    plugins: { boundaries },
    settings: {
      // Resolve imports (including the "@/" tsconfig path alias) to real files so
      // boundaries can classify cross-layer dependencies rather than treating them
      // as external.
      'import/resolver': {
        typescript: { project: './tsconfig.json' }
      },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/webparts/requisition/app/**' },
        { type: 'app', mode: 'file', pattern: 'src/webparts/requisition/RequisitionWebPart.ts' },
        { type: 'feature', pattern: 'src/webparts/requisition/features/*', capture: ['featureName'] },
        { type: 'shared', pattern: 'src/webparts/requisition/shared/**' }
      ]
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            // app composes the whole app → may import every layer
            { from: 'app', allow: ['app', 'feature', 'shared'] },
            // feature → shared + its own feature only (never cross-feature)
            {
              from: 'feature',
              allow: ['shared', ['feature', { featureName: '${from.featureName}' }]]
            },
            // shared is the lowest layer → shared only (prevents circular deps)
            { from: 'shared', allow: ['shared'] }
          ]
        }
      ],
      'boundaries/no-unknown': 'error',
      'boundaries/no-unknown-files': 'error'
    }
  }
];
