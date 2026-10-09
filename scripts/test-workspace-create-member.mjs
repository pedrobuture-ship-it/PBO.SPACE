import assert from 'node:assert/strict'
import { addWorkspaceMember, canAssignWorkspaceRole, MemberCreationError, validateWorkspaceMemberInput } from '../supabase/functions/_shared/workspace-member-logic.mjs'

const workspaceId='10000000-0000-4000-8000-000000000001'
const input={workspace_id:workspaceId,display_name:'Ana Pessoa',email:'Ana@example.test',password:'start1234',workspace_role:'member'}
let checks=0
function check(actual,expected,label){assert.deepEqual(actual,expected,label);checks++}
function rejects(fn,code){assert.throws(fn,error=>error instanceof MemberCreationError&&error.code===code);checks++}
for(const [caller,target,expected] of [['owner','admin',true],['owner','viewer',true],['admin','member',true],['admin','admin',false],['member','member',false],['viewer','viewer',false]]) check(canAssignWorkspaceRole(caller,target),expected,`${caller} pode atribuir ${target}`)
rejects(()=>validateWorkspaceMemberInput({...input,email:'invalido'}),'invalid_email')
rejects(()=>validateWorkspaceMemberInput({...input,password:'123'}),'weak_password')
rejects(()=>validateWorkspaceMemberInput({...input,app_role:'admin'}),'invalid_input')
rejects(()=>validateWorkspaceMemberInput({...input,user_id:'privileged'}),'invalid_input')
check(validateWorkspaceMemberInput(input).email,'ana@example.test','Email normalizado')

async function run(role,{existingId=null,already=false,failMembership=false}={}){
 const calls={create:0,profile:[],membership:0,rollback:0,passwordTouched:0}
 const result=await addWorkspaceMember(validateWorkspaceMemberInput(input),'caller',{
  async getWorkspaceRole(){return role}, async findAuthUser(){return existingId}, async hasMembership(){return already},
  async ensureProfile(id,name,isNew){calls.profile.push({id,name,isNew})}, async createAuthUser(payload){calls.create++;check(payload.emailConfirmed,true,'Nova conta já confirmada');return{id:'new-user'}},
  async addMembership(){calls.membership++;if(failMembership) throw new Error('database unavailable');return{user_id:existingId??'new-user'}}, async rollbackCreatedUser(){calls.rollback++;return true},
 })
 return {result,calls}
}
let {result,calls}=await run('owner')
check(result.status,'created','Owner cria membro');check(calls.create,1,'Auth cria conta nova');check(calls.profile[0],{id:'new-user',name:'Ana Pessoa',isNew:true},'Profile new user recebe role inicial somente')
;({result,calls}=await run('admin'))
check(result.status,'created','Workspace admin pode criar member')
async function deniedRole(role){
 let error
 try{await run(role)}catch(cause){error=cause}
 assert.ok(error instanceof MemberCreationError&&error.code==='forbidden',`${role} deve ser recusado`)
 checks++
}
await deniedRole('member');await deniedRole('viewer')
;({result,calls}=await run('owner',{existingId:'old-user'}))
check(result.status,'existing_added','Conta existente entra no workspace')
check(calls.create,0,'Conta existente não passa pelo Auth create')
check(calls.profile[0].isNew,false,'Conta existente não recebe atualização de app_role ou senha')
;({result,calls}=await run('owner',{existingId:'old-user',already:true}))
check(result.status,'already_member','Membro duplicado é reconhecido')
check(calls.membership,0,'Membro duplicado não repete insert')
let error
try{await run('owner',{failMembership:true})}catch(cause){error=cause}
check(error instanceof MemberCreationError&&error.code==='add_failed',true,'Falha de membership devolve erro seguro')
check((await (async()=>{let count=0;await addWorkspaceMember(validateWorkspaceMemberInput(input),'caller',{async getWorkspaceRole(){return'owner'},async findAuthUser(){return null},async hasMembership(){return false},async ensureProfile(){},async createAuthUser(){return{id:'new-user'}},async addMembership(){throw Error('failed')},async rollbackCreatedUser(){count++;return true}}).catch(()=>{});return count})()),1,'Falha pós-criação tenta rollback da conta nova')
console.log(`PASS: ${checks} verificações de criação de membro e permissões por workspace_role.`)
