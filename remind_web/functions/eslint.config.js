module.exports = [
  {
    ignores: ["node_modules/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        fetch: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "quotes": ["error", "double", {"allowTemplateLiterals": true}],
      "semi": ["error", "always"],
    },
  },
];
