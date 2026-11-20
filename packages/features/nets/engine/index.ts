import { DEFAULT_ROLES } from '@pcbk/domain';
import { endKey, resolveNets } from '@pcbk/domain/rules';
import { CommandTargetNotFound, reject } from '@pcbk/engine';
import type { CommandSpec, EngineModule } from '@pcbk/engine';
import {
  AddRoleSchema,
  AssignNetSchema,
  JoinNetsSchema,
  RemoveRoleSchema,
  UpdateRoleSchema,
} from '../contract';
import type {
  AddRoleParams,
  AssignNetParams,
  JoinNetsParams,
  RemoveRoleParams,
  UpdateRoleParams,
} from '../contract';
import { netsDerivations } from './derive';

const assign: CommandSpec<AssignNetParams> = {
  id: 'nets.assign',
  title: 'nets.assign',
  params: AssignNetSchema,
  run(doc, { anchor, labelId, name, roleId }) {
    const { netOf } = resolveNets(doc);
    const member = endKey(anchor);
    const net = netOf.get(member);
    if (net === undefined) throw new CommandTargetNotFound(member);
    if (typeof roleId === 'string' && !doc.roles.some(({ id }) => id === roleId)) {
      reject('unknown_role');
    }
    if (name === undefined && roleId === undefined) return;

    const cleanName = name?.trim();
    const labels = doc.netLabels;
    const target = labels.findIndex((label) => endKey(label.anchor) === member);
    for (let index = labels.length - 1; index >= 0; index--) {
      const label = labels[index]!;
      if (netOf.get(endKey(label.anchor)) !== net) continue;
      if (cleanName !== undefined) {
        if (index === target && cleanName) label.name = cleanName;
        else delete label.name;
      }
      if (roleId !== undefined) {
        if (index === target && roleId !== null) label.roleId = roleId;
        else delete label.roleId;
      }
      if (!label.name && !label.roleId) labels.splice(index, 1);
    }
    if (target === -1 && (cleanName || roleId)) {
      labels.push({
        id: labelId,
        anchor,
        source: 'user',
        ...(cleanName ? { name: cleanName } : {}),
        ...(roleId ? { roleId } : {}),
      });
    }
  },
};

const join: CommandSpec<JoinNetsParams> = {
  id: 'nets.join',
  title: 'nets.join',
  params: JoinNetsSchema,
  alsoWrites: ['connections'],
  run(doc, { connectionId, a, b }) {
    const { netOf } = resolveNets(doc);
    const left = endKey(a);
    const right = endKey(b);
    const leftNet = netOf.get(left);
    const rightNet = netOf.get(right);
    if (leftNet === undefined) throw new CommandTargetNotFound(left);
    if (rightNet === undefined) throw new CommandTargetNotFound(right);
    if (leftNet === rightNet) reject('already_joined');
    doc.connections.push({ id: connectionId, a, b, basis: 'assumed' });
  },
};

const addRole: CommandSpec<AddRoleParams> = {
  id: 'roles.add',
  title: 'roles.add',
  params: AddRoleSchema,
  run(doc, { role }) {
    if (doc.roles.some(({ id }) => id === role.id)) reject('duplicate_role');
    doc.roles.push(role);
  },
};

const updateRole: CommandSpec<UpdateRoleParams> = {
  id: 'roles.update',
  title: 'roles.update',
  params: UpdateRoleSchema,
  run(doc, { id, label, kind, nominalV, color }) {
    const role = doc.roles.find((entry) => entry.id === id);
    if (!role) throw new CommandTargetNotFound(id);
    if (label !== undefined) role.label = label;
    if (kind !== undefined) role.kind = kind;
    if (nominalV === null) delete role.nominalV;
    else if (nominalV !== undefined) role.nominalV = nominalV;
    if (color !== undefined) role.color = color;
  },
};

const removeRole: CommandSpec<RemoveRoleParams> = {
  id: 'roles.remove',
  title: 'roles.remove',
  params: RemoveRoleSchema,
  run(doc, { id }) {
    if (DEFAULT_ROLES.some((role) => role.id === id)) reject('default_role');
    const index = doc.roles.findIndex((role) => role.id === id);
    if (index === -1) throw new CommandTargetNotFound(id);
    if (doc.netLabels.some(({ roleId }) => roleId === id)) reject('role_in_use');
    doc.roles.splice(index, 1);
  },
};

export const netsEngine: EngineModule = {
  id: 'nets',
  owns: ['netLabels', 'roles'],
  commands: [assign, join, addRole, updateRole, removeRole],
  derive: netsDerivations,
};
