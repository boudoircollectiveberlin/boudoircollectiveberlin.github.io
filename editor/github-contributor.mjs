/** Workspace operator authentication, not authentication of visitors to a shared server. */
export async function verifiedGitHubLogin(token,fetcher=fetch) {
  if(!token)throw Error('GitHub-Anmeldung fehlt. Codespaces oder gh auth token verwenden; Token nie ins Repository schreiben.');
  const response=await fetcher('https://api.github.com/user',{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','User-Agent':'BCB-Contribution-Editor'}});
  if(!response.ok)throw Error('GitHub-Identität konnte nicht bestätigt werden.');
  const user=await response.json(),login=String(user.login || '').toLowerCase();
  if(!/^[a-z0-9-]+$/.test(login))throw Error('Ungültige GitHub-Identität.');
  return login;
}
