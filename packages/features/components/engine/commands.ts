import { nextRef } from '@pcbk/domain';
import type { BoardDoc, Component } from '@pcbk/domain';
import { CommandTargetNotFound } from '@pcbk/engine';
import type { CommandSpec } from '@pcbk/engine';
import {
  AddComponentSchema,
  UpdateComponentSchema,
  AddPinSchema,
  PinTargetSchema,
  RenamePinSchema,
  SetNcSchema,
} from '../contract';
import type {
  AddComponentParams,
  UpdateComponentParams,
  AddPinParams,
  PinTargetParams,
  RenamePinParams,
  SetNcParams,
} from '../contract';

function component(doc: BoardDoc, id: string): Component {
  const found = doc.components.find((item) => item.id === id);
  if (!found) throw new CommandTargetNotFound(id);
  return found;
}
function pin(doc: BoardDoc, params: PinTargetParams) {
  const found = component(doc, params.id).pins.find((item) => item.id === params.pinId);
  if (!found) throw new CommandTargetNotFound(`${params.id}:${params.pinId}`);
  return found;
}
const add: CommandSpec<AddComponentParams> = {
  id: 'components.add',
  title: 'components.add',
  params: AddComponentSchema,
  run(doc, params) {
    doc.components.push({
      id: params.id,
      kind: params.kind,
      ref: params.ref ?? nextRef(doc, params.kind),
      marking: params.marking ?? '',
      value: params.value ?? '',
      identified: false,
      dnp: false,
      note: '',
      pins: params.pins.map((item) => ({ ...item, nc: false })),
    });
  },
};
const update: CommandSpec<UpdateComponentParams> = {
  id: 'components.update',
  title: 'components.update',
  params: UpdateComponentSchema,
  run(doc, params) {
    const target = component(doc, params.id);
    if (params.ref !== undefined) target.ref = params.ref;
    if (params.kind !== undefined) target.kind = params.kind;
    if (params.marking !== undefined) target.marking = params.marking;
    if (params.value !== undefined) target.value = params.value;
    if (params.note !== undefined) target.note = params.note;
    if (params.dnp !== undefined) target.dnp = params.dnp;
    if (params.identified !== undefined) target.identified = params.identified;
  },
};
const addPin: CommandSpec<AddPinParams> = {
  id: 'components.addPin',
  title: 'components.addPin',
  params: AddPinSchema,
  run(doc, params) {
    component(doc, params.id).pins.push({ ...params.pin, nc: false });
  },
};
const renamePin: CommandSpec<RenamePinParams> = {
  id: 'components.renamePin',
  title: 'components.renamePin',
  params: RenamePinSchema,
  run(doc, params) {
    const target = pin(doc, params);
    if (params.name === null) delete target.name;
    else target.name = params.name;
  },
};
const setNc: CommandSpec<SetNcParams> = {
  id: 'components.setNc',
  title: 'components.setNc',
  params: SetNcSchema,
  run(doc, params) {
    pin(doc, params).nc = params.nc;
  },
};
const removePin: CommandSpec<PinTargetParams> = {
  id: 'components.removePin',
  title: 'components.removePin',
  params: PinTargetSchema,
  run(doc, params) {
    const target = component(doc, params.id);
    const index = target.pins.findIndex((item) => item.id === params.pinId);
    if (index < 0) throw new CommandTargetNotFound(`${params.id}:${params.pinId}`);
    target.pins.splice(index, 1);
  },
};
export const commands = [add, update, addPin, renamePin, setNc, removePin];
