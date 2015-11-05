export async function getAll () {
  return await this.getAllRemotes()
}

getAll.permission = 'admin'
getAll.description = 'Gets all existing fs remote points'

export async function get (id) {
  return await this.getRemote(id)
}

get.permission = 'admin'
get.description = 'Gets an existing fs remote point'
get.params = {
  id: {type: 'string'}
}

export async function list (id) {
  return await this.listRemote(id)
}

list.permission = 'admin'
list.description = 'Lists the files found in a remote point'
list.params = {
  id: {type: 'string'}
}

export async function create ({name, url}) {
  return await this.createRemote({name, url})
}

create.permission = 'admin'
create.description = 'Creates a new fs remote point'
create.params = {
  name: {type: 'string'},
  url: {type: 'string'}
}

export async function set ({id, name, url, enabled}) {
  await this.updateRemote(id, {name, url, enabled})
}

set.permission = 'admin'
set.description = 'Modifies an existing fs remote point'
set.params = {
  id: {type: 'string'},
  name: {type: 'string', optional: true},
  url: {type: 'string', optional: true},
  enabled: {type: 'boolean', optional: true}
}

export async function importVm ({id, file, host}) {
  await this.importVmFromRemote(id, file, host)
}

importVm.permission = 'admin'
importVm.description = 'Imports a VM into host, from a file found in the chosen remote'
importVm.params = {
  id: {type: 'string'},
  file: {type: 'string'},
  host: {type: 'string'}
}

importVm.resolve = {
  host: ['host', 'host', 'administrate']
}

async function delete_ ({id}) {
  await this.removeRemote(id)
}

delete_.permission = 'admin'
delete_.description = 'Deletes an existing fs remote point'
delete_.params = {
  id: {type: 'string'}
}

export {delete_ as delete}
