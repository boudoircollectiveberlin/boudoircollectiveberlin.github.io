const actions=new Set(['read','create','update','approve','publish']);
export function allowed(policy,identity,action,resource,document={}) {
  if(policy?.version!==1 || typeof identity?.id!=='string' || !identity.id.trim() || !Array.isArray(identity.roles) || !actions.has(action))return false;
  return identity.roles.some(role=>{
    const grants=Object.hasOwn(policy.roles || {},role)?policy.roles[role]:undefined;
    const grant=(grants?.[resource] || grants?.['*'])?.[action];
    if(grant===true)return true;
    if(!grant || typeof grant!=='object' || Array.isArray(grant) || !Object.keys(grant).length || Object.keys(grant).some(key=>!['documents','languages'].includes(key)))return false;
    if(grant.documents) {
      const assigned=identity.documents?.includes(document.id);
      const owned=document.ownerId===identity.id;
      if(grant.documents==='assigned' && !assigned)return false;
      if(grant.documents==='assigned-or-owned' && !assigned && !owned)return false;
      if(!['assigned','assigned-or-owned'].includes(grant.documents))return false;
    }
    if(grant.languages && (grant.languages!=='assigned' || !['de','en'].includes(document.locale) || !identity.languages?.includes(document.locale)))return false;
    return true;
  });
}
export function requirePermission(policy,identity,action,resource,document) {
  if(!allowed(policy,identity,action,resource,document))throw Object.assign(Error('Für diese Aktion fehlt die redaktionelle Berechtigung.'),{status:403});
}
// Only the loopback integration constructs this identity. Never read roles from HTTP input.
export const localOperator = Object.freeze({id:'local-operator',roles:['local-operator']});
