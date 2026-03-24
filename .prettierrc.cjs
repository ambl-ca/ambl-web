/** @type {import("prettier").Config} */
module.exports = {
  plugins: [require("prettier-plugin-astro")],
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  semi: true,
  trailingComma: "es5",
  printWidth: 100,
};
