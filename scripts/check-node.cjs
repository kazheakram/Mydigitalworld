// Friendly check before starting: Ribbonmere needs Node 22.13+ (for its built-in database).
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 13)) {
  console.error(`\n  ✗ Ribbonmere needs Node.js 22.13 or newer, but this computer has ${process.versions.node}.`);
  console.error('    Download the current "LTS" version from https://nodejs.org, install it, then try again.\n');
  process.exit(1);
}
