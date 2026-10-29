import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', '.tanstack/**', 'src/routeTree.gen.ts', 'artifacts/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['src/routes/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['bun:sqlite', '**/db/**', '**/services/**'], message: 'UI must call a feature server function, never the database or services directly.' }],
      }],
    },
  },
);
