module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  rules: {
    'no-console': 'error',
    'no-debugger': 'error',
    semi: ['error', 'always'],
    '@typescript-eslint/class-name-casing': 'off',
  },
  parserOptions: {
    parser: '@typescript-eslint/parser',
  },
  overrides: [
    {
      files: ['src/interfaces/*.d.ts'],
      rules: {
        semi: ['off'],
      },
    },
  ],
};
