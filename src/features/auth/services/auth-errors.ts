// Nunca apresentar mensagens internas de Auth/PostgREST diretamente nos formulários.
export function friendlyAuthError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  switch (code) {
    case 'invalid_credentials': return 'E-mail ou senha incorretos.'
    case 'email_not_confirmed': return 'Confirme seu e-mail antes de entrar.'
    case 'user_banned': return 'Esta conta está desativada. Fale com um administrador.'
    case 'weak_password': return 'Escolha uma senha mais forte.'
    case 'same_password': return 'Escolha uma senha diferente da atual.'
    case 'over_email_send_rate_limit': return 'Aguarde alguns minutos antes de pedir outro e-mail.'
    case 'otp_expired': return 'O link expirou. Solicite um novo e-mail.'
    case 'reauthentication_needed': return 'Entre novamente antes de alterar sua senha.'
    default: return 'Não foi possível concluir a ação. Tente novamente.'
  }
}
