// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // The API and the website are their own projects, each with its own checks.
    ignores: ["dist/*", "api/*", "api-prisma/*", "web/*"],
  }
]);
