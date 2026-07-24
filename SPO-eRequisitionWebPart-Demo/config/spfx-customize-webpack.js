'use strict';

const path = require('node:path');

/**
 * Mirrors the tsconfig "@/*" path alias for the webpack bundling step.
 *
 * TypeScript type-checks against `src/` via the tsconfig `paths` mapping, but the
 * SPFx webpack bundle is built from the compiled output under `lib/`. The runtime
 * alias must therefore resolve `@` to `lib/webparts/requisition`.
 *
 * The `@/<...>` convention is safe alongside scoped npm packages (e.g.
 * `@fluentui/react`): webpack only rewrites requests that start with `@/`.
 *
 * Wired via config/heft.json task "customize-configure-webpack"
 * (@microsoft/spfx-heft-plugins → customize-spfx-webpack-configuration-plugin).
 */
module.exports = function customizeWebpackConfig(config) {
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  config.resolve.alias['@'] = path.resolve(__dirname, '..', 'lib', 'webparts', 'requisition');
};
