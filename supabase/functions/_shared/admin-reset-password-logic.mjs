export class PasswordResetError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validatePasswordResetInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['target_user_id', 'new_password'].includes(key))) {
    throw new PasswordResetError('invalid_input', 'Dados inválidos.')
  }
  const targetUserId = typeof value.target_user_id === 'string' ? value.target_user_id.trim() : ''
  const newPassword = typeof value.new_password === 'string' ? value.new_password : ''
  if (!uuidPattern.test(targetUserId)) throw new PasswordResetError('invalid_user', 'Usuário inválido.')
  if (newPassword.length < 8) throw new PasswordResetError('weak_password', 'A nova senha deve ter ao menos 8 caracteres.')
  if (newPassword.length > 128) throw new PasswordResetError('invalid_password', 'A nova senha excede o limite permitido.')
  return { targetUserId, newPassword }
}

export function canResetAdminTarget(callerRole, callerId, targetId, targetRole) {
  if (!['admin', 'superadmin'].includes(callerRole) || callerId === targetId || targetRole === 'superadmin') return false
  if (callerRole === 'admin') return targetRole === 'user'
  return targetRole === 'admin' || targetRole === 'user'
}
