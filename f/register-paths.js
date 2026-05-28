// register-paths.js
const tsConfigPaths = require('tsconfig-paths');
const path = require('path');

const baseUrl = path.join(__dirname, 'dist');
const cleanup = tsConfigPaths.register({
  baseUrl,
  "paths": {
      "@core/*": ["core/*"],
      "@modules/*": ["modules/*"],
      "@docs/*": ["docs/*"],
      "@shared/*": ["shared/*"],
      "@src/*": ["./*"]
    
  }
});
