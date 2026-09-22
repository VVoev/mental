import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'test-results/**', 'playwright-report/**', 'eval/runs/**', 'eval/private/**', 'eval/transcripts/**', '.codex/**'] },
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } } },
  { files: ['e2e/**/*.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 'vue/multi-word-component-names': 'off' } },
);
