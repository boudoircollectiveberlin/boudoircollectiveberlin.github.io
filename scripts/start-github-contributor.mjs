import { verifiedGitHubLogin } from '../editor/github-contributor.mjs';
import { editorIdentity } from '../editor/environment.mjs';
process.env.BCB_EDITOR_VERIFIED_LOGIN=await verifiedGitHubLogin(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
process.env.BCB_EDITOR_PROFILE='github-contributor';
editorIdentity(process.cwd()); // Fail closed before starting any server if assignment is missing.
await import('./sync-public.mjs');
await import('./start-astro.mjs');
