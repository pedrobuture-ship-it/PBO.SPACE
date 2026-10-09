export class MemberCreationError extends Error {
  constructor(code, message, status=400) {
    super(message)
    this.code=code
    this.status=status
  }
}

const workspaceRoles=new Set(['admin','member','viewer'])
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateWorkspaceMemberInput(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new MemberCreationError('invalid_input','Dados inválidos.')
  const allowed=new Set(['workspace_id','display_name','email','password','workspace_role'])
  if (Object.keys(value).some(key=>!allowed.has(key))) throw new MemberCreationError('invalid_input','Dados inválidos.')
  const workspaceId=typeof value.workspace_id==='string'?value.workspace_id.trim():''
  const displayName=typeof value.display_name==='string'?value.display_name.trim():''
  const email=typeof value.email==='string'?value.email.trim().toLowerCase():''
  const password=typeof value.password==='string'?value.password:''
  const workspaceRole=value.workspace_role
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)
    || displayName.length<2 || displayName.length>120 || !emailPattern.test(email) || email.length>254
    || password.length<8 || password.length>128 || !workspaceRoles.has(workspaceRole)) {
    if (!emailPattern.test(email) || email.length>254) throw new MemberCreationError('invalid_email','E-mail inválido.')
    if (password.length<8) throw new MemberCreationError('weak_password','Senha muito curta.')
    throw new MemberCreationError('invalid_input','Revise nome e cargo do workspace.')
  }
  return { workspaceId,displayName,email,password,workspaceRole }
}

export function canAssignWorkspaceRole(callerRole,targetRole) {
  if (callerRole==='owner') return workspaceRoles.has(targetRole)
  if (callerRole==='admin') return targetRole==='member'||targetRole==='viewer'
  return false
}

export async function addWorkspaceMember(input,callerId,deps) {
  const callerRole=await deps.getWorkspaceRole(input.workspaceId,callerId)
  if (!canAssignWorkspaceRole(callerRole,input.workspaceRole)) {
    throw new MemberCreationError('forbidden','Você não possui permissão.',403)
  }

  async function addExistingUser(userId) {
    if (await deps.hasMembership(input.workspaceId,userId)) {
      return { status:'already_member',message:'Este usuário já faz parte do workspace.' }
    }
    await deps.ensureProfile(userId,input.displayName,false)
    try {
      const member=await deps.addMembership(input.workspaceId,userId,input.workspaceRole)
      return { status:'existing_added',message:'Usuário existente adicionado ao workspace.',member }
    } catch(error) {
      if (error?.code==='23505'||error?.code==='duplicate_membership') {
        return { status:'already_member',message:'Este usuário já faz parte do workspace.' }
      }
      throw new MemberCreationError('add_failed','Não foi possível adicionar o membro.',500)
    }
  }

  const existingId=await deps.findAuthUser(input.email)
  if (existingId) return addExistingUser(existingId)

  const operationStartedAt=new Date().toISOString()
  let created
  try {
    created=await deps.createAuthUser({ email:input.email,password:input.password,displayName:input.displayName,emailConfirmed:true })
  } catch {
    // Corrida entre duas criações: só reusa a conta se o Auth confirmar o email existente.
    const racedId=await deps.findAuthUser(input.email).catch(()=>null)
    if (racedId) return addExistingUser(racedId)
    throw new MemberCreationError('create_failed','Não foi possível adicionar o membro.',500)
  }

  try {
    await deps.ensureProfile(created.id,input.displayName,true)
    const member=await deps.addMembership(input.workspaceId,created.id,input.workspaceRole)
    return { status:'created',message:'Membro criado e adicionado ao workspace.',member }
  } catch(error) {
    if (error?.code==='23505'||error?.code==='duplicate_membership') {
      return { status:'already_member',message:'Este usuário já faz parte do workspace.' }
    }
    await deps.rollbackCreatedUser(created.id,operationStartedAt).catch(()=>false)
    throw new MemberCreationError('add_failed','Não foi possível adicionar o membro.',500)
  }
}
