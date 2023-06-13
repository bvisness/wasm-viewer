module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:@typescript-eslint/strict",
  ],
  rules: {
    "quotes": ["error", "double"],
    "no-irregular-whitespace": "off",
    "indent": ["error", 2, { "SwitchCase": 1 }],

    "@typescript-eslint/prefer-literal-enum-member": "off",
    "@typescript-eslint/no-unused-vars": ["warn", {
      "varsIgnorePattern": "^_",
      "argsIgnorePattern": "^_",
    }],
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/no-base-to-string": "off",

    "semi": "off",
    "@typescript-eslint/semi": "error",

    "@typescript-eslint/member-delimiter-style": "error",

    // you have now entered 🤡 Clown Town 🤡

    // while (true) is evil 🤡
    "no-constant-condition": "off",
    "@typescript-eslint/no-unnecessary-condition": ["warn", { "allowConstantLoopConditions": true }],

    "@typescript-eslint/no-explicit-any": "off", // any is always evil, even when you are explicit 🤡
    "@typescript-eslint/no-misused-promises": "off", // async functions in addEventListener are evil 🤡
    "@typescript-eslint/ban-types": "off", // we're too stupid to understand if you have a custom type named Function 🤡 (by design 🤡)
    "@typescript-eslint/consistent-indexed-object-style": "off", // index signatures are not "readable" 🤡
  },
};
