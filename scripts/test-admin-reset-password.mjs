import assert from 'node:assert/strict'
import { canResetAdminTarget, PasswordResetError, validatePasswordResetInput } from '../supabase/functions/_shared/admin-reset-password-logic.mjs'
const userId='10000000-0000-4000-8000-000000000001'
const adminId='10000000-0000-4000-8000-000000000002'
let checks=0
function check(value,expected,label){assert.equal(value,expected,label);checks++}
function reject(payload,code){assert.throws(()=>validatePasswordResetInput(payload),error=>error instanceof PasswordResetError&&error.code===code);checks++}
check(validatePasswordResetInput({target_user_id:userId,new_password:'nova-senha-segura'}).targetUserId,userId,'Aceita apenas o destino e a nova senha')
reject({target_user_id:userId,new_password:'1234567'},'weak_password')
reject({target_user_id:'invalid',new_password:'nova-senha'},'invalid_user')
reject({target_user_id:userId,new_password:'nova-senha',app_role:'admin'},'invalid_input')
reject({target_user_id:userId,new_password:'nova-senha',service_role:'secret'},'invalid_input')
reject({target_user_id:userId,new_password:'nova-senha',metadata:{app_role:'admin'}},'invalid_input')
check(canResetAdminTarget('admin',adminId,userId,'user'),true,'Admin global redefine usuário comum')
check(canResetAdminTarget('admin',adminId,userId,'admin'),false,'Admin global não redefine outro admin')
check(canResetAdminTarget('admin',adminId,userId,'superadmin'),false,'Admin global não redefine superadmin')
check(canResetAdminTarget('superadmin',adminId,userId,'admin'),true,'Superadmin redefine conta admin')
check(canResetAdminTarget('superadmin',adminId,userId,'user'),true,'Superadmin redefine usuário comum')
check(canResetAdminTarget('superadmin',adminId,userId,'superadmin'),false,'Superadmin protegido de redefinição')
check(canResetAdminTarget('superadmin',adminId,adminId,'user'),false,'Não pode redefinir a própria senha por esta ação administrativa')
check(canResetAdminTarget('workspace_admin',adminId,userId,'user'),false,'Workspace admin sem privilégio global não redefine senha')
check(canResetAdminTarget('member',adminId,userId,'user'),false,'Member não redefine senha de outra pessoa')
check(canResetAdminTarget('viewer',adminId,userId,'user'),false,'Viewer não redefine senha de outra pessoa')
console.log(`PASS: ${checks} verificações de validação e autorização para redefinição administrativa.`)
