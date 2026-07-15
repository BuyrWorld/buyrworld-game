// Points git at the versioned .githooks/ directory so the pre-push release gate
// is active for everyone after `npm install`. No-ops outside a git checkout
// (e.g. CI tarball installs) and never fails the install.
import { execSync } from 'node:child_process';

try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  execSync('git config core.hooksPath .githooks');
  console.log('✔ git hooks wired to .githooks (pre-push runs `npm run gate`)');
} catch {
  /* not a git checkout, or git unavailable — skip silently */
}
