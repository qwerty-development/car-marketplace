/**
 * PostCSS deduplication script.
 * NativeWind v2 requires PostCSS to run synchronously.
 * Some packages (e.g. @expo/metro-config, tailwindcss) may install
 * their own nested PostCSS copies with async behavior.
 * This script removes all nested copies so everything uses the
 * pinned top-level postcss@8.4.31.
 *
 * Runs as a postinstall hook — works on both local and EAS builds.
 */
const fs = require('fs');
const path = require('path');

const nm = path.join(__dirname, '..', 'node_modules');
let removed = 0;

function tryRemove(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('[fix-postcss] Removed:', dir.replace(nm + '/', ''));
    removed++;
  }
}

// Walk node_modules one level deep (and two levels for scoped packages)
for (const entry of fs.readdirSync(nm)) {
  if (entry === '.bin' || entry === '.cache' || entry === 'postcss') continue;

  const nested = path.join(nm, entry, 'node_modules', 'postcss');
  tryRemove(nested);

  // Scoped packages (@expo/metro-config, etc.)
  if (entry.startsWith('@')) {
    const scopeDir = path.join(nm, entry);
    try {
      for (const sub of fs.readdirSync(scopeDir)) {
        tryRemove(path.join(scopeDir, sub, 'node_modules', 'postcss'));
      }
    } catch (e) { /* not a directory */ }
  }
}

if (removed > 0) {
  console.log(`[fix-postcss] Done. Removed ${removed} nested postcss copies.`);
} else {
  console.log('[fix-postcss] No nested postcss copies found. All clean.');
}
