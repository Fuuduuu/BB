import { FOOTPRINTS, footprintGeometry, footprintPinIds, nextRef } from '@pcbk/domain';
import type { BoardDoc, BoardPlacement, Component, Pin } from '@pcbk/domain';
import { CommandTargetNotFound, reject } from '@pcbk/engine';
import type { CommandSpec } from '@pcbk/engine';
import {
  AddComponentSchema,
  UpdateComponentSchema,
  AddOwnPinSchema,
  AddPinSchema,
  AlignSchema,
  ChangeFootprintSchema,
  ComponentTargetSchema,
  PinTargetSchema,
  PlaceOnBoardSchema,
  RenamePinSchema,
  RotateSchema,
  SetLabelOffsetSchema,
  SetNcSchema,
  SetScaleSchema,
} from '../contract';
import type {
  AddComponentParams,
  UpdateComponentParams,
  AddOwnPinParams,
  AddPinParams,
  AlignParams,
  BoardInput,
  ChangeFootprintParams,
  ComponentTargetParams,
  PinTargetParams,
  PlaceOnBoardParams,
  RenamePinParams,
  RotateParams,
  SetLabelOffsetParams,
  SetNcParams,
  SetScaleParams,
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

function normalizeAngle(degrees: number): number {
  const remainder = degrees % 360;
  return (remainder < 0 ? (remainder + 360) % 360 : remainder) || 0;
}

function makeBoardPlacement(input: BoardInput, pins: readonly Pick<Pin, 'id'>[]): BoardPlacement {
  const definition = FOOTPRINTS.find((entry) => entry.key === input.footprint);
  if (!definition) reject('invalid_footprint');
  const params = { ...definition.defaults, ...input.params };
  const padIds = footprintPinIds(input.footprint, params);
  if (!padIds) reject('invalid_footprint');
  if (input.footprint !== 'area') {
    const pinIds = new Set(pins.map((pin) => pin.id));
    if (pins.length !== padIds.length || !padIds.every((id) => pinIds.has(id))) {
      reject('footprint_pins_mismatch');
    }
  }
  return {
    footprint: input.footprint,
    params,
    center: input.center,
    rotationDeg: normalizeAngle(input.rotationDeg ?? 0),
    side: input.side ?? 'top',
    scaleX: 1,
    scaleY: 1,
    customPads: {},
  };
}

function placedBoard(doc: BoardDoc, id: string): BoardPlacement {
  const board = component(doc, id).board;
  if (!board) reject('component_not_placed');
  return board;
}

function hasFootprintPad(board: BoardPlacement, pinId: string): boolean {
  const padIds = footprintPinIds(board.footprint, board.params);
  return padIds?.some((padId) => (board.padMap?.[padId] ?? padId) === pinId) ?? false;
}

function compatiblePadMap(padMap: Record<string, string>, footprintIds: ReadonlySet<string>) {
  const links = new Map(
    Object.entries(padMap).filter(
      ([padId, pinId]) => footprintIds.has(padId) && footprintIds.has(pinId),
    ),
  );
  return Object.fromEntries(
    [...links].filter(([padId, pinId]) => {
      // Other pads keep their own IDs, so a remap is valid only in a closed cycle.
      const visited = new Set([padId]);
      let next: string | undefined = pinId;
      while (next !== undefined && !visited.has(next)) {
        visited.add(next);
        next = links.get(next);
      }
      return next === padId;
    }),
  );
}

const add: CommandSpec<AddComponentParams> = {
  id: 'components.add',
  title: 'components.add',
  params: AddComponentSchema,
  run(doc, params) {
    const board = params.board ? makeBoardPlacement(params.board, params.pins) : undefined;
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
      ...(board ? { board } : {}),
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
    const target = component(doc, params.id);
    if (target.board && target.board.footprint !== 'area') reject('pin_needs_pad');
    target.pins.push({ ...params.pin, nc: false });
  },
};
const addOwnPin: CommandSpec<AddOwnPinParams> = {
  id: 'components.addOwnPin',
  title: 'components.addOwnPin',
  params: AddOwnPinSchema,
  run(doc, { id, pin, local, sizeMm }) {
    const target = component(doc, id);
    const board = target.board;
    if (!board) reject('component_not_placed');
    if (target.pins.some((item) => item.id === pin.id) || hasFootprintPad(board, pin.id))
      reject('duplicate_pin');
    target.pins.push({ ...pin, nc: false });
    board.customPads = {
      ...board.customPads,
      [pin.id]: { local, sizeMm, shape: 'circle', through: false },
    };
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
  run(doc, { id, pinId }) {
    const target = component(doc, id);
    const index = target.pins.findIndex((item) => item.id === pinId);
    if (index < 0) throw new CommandTargetNotFound(`${id}:${pinId}`);
    const board = target.board;
    if (board && hasFootprintPad(board, pinId)) reject('footprint_pin_locked');
    target.pins.splice(index, 1);
    if (board) {
      delete board.customPads[pinId];
      if (board.padMap) {
        for (const [padId, mappedPinId] of Object.entries(board.padMap)) {
          if (mappedPinId === pinId) delete board.padMap[padId];
        }
      }
    }
  },
};
const placeOnBoard: CommandSpec<PlaceOnBoardParams> = {
  id: 'components.placeOnBoard',
  title: 'components.placeOnBoard',
  params: PlaceOnBoardSchema,
  run(doc, params) {
    const target = component(doc, params.id);
    if (target.board) reject('already_placed');
    target.board = makeBoardPlacement(params.board, target.pins);
  },
};
const removeFromBoard: CommandSpec<ComponentTargetParams> = {
  id: 'components.removeFromBoard',
  title: 'components.removeFromBoard',
  params: ComponentTargetSchema,
  run(doc, params) {
    const target = component(doc, params.id);
    if (target.board) delete target.board;
  },
};
const changeFootprint: CommandSpec<ChangeFootprintParams> = {
  id: 'components.changeFootprint',
  title: 'components.changeFootprint',
  params: ChangeFootprintSchema,
  run(doc, params) {
    const target = component(doc, params.id);
    const board = placedBoard(doc, params.id);
    const definition = FOOTPRINTS.find((entry) => entry.key === params.footprint);
    if (!definition) reject('invalid_footprint');
    const footprintParams = { ...definition.defaults, ...params.params };
    const geometry = footprintGeometry(params.footprint, footprintParams);
    if (!geometry) reject('invalid_footprint');
    if (params.footprint === 'area') {
      board.footprint = params.footprint;
      board.params = footprintParams;
      return;
    }
    const existing = new Map(target.pins.map((pin) => [pin.id, pin]));
    const footprintIds = new Set(geometry.pads.map(({ id }) => id));
    const ownPins = target.pins.filter(
      ({ id }) => !footprintIds.has(id) && Object.hasOwn(board.customPads, id),
    );
    const footprintPins = geometry.pads.map(({ id, name }) => {
      const retained = existing.get(id);
      if (retained) return retained;
      if (!Object.hasOwn(params.newPinUids, id)) reject('missing_pin_uid');
      return {
        id,
        uid: params.newPinUids[id]!,
        nc: false,
        ...(name === undefined ? {} : { name }),
      };
    });
    target.pins = [...footprintPins, ...ownPins];
    board.footprint = params.footprint;
    board.params = footprintParams;
    if (board.padMap) {
      const retained = compatiblePadMap(board.padMap, footprintIds);
      if (Object.keys(retained).length > 0) board.padMap = retained;
      else delete board.padMap;
    }
    for (const id of Object.keys(board.customPads)) {
      if (footprintIds.has(id) || !existing.has(id)) delete board.customPads[id];
    }
  },
};
const rotate: CommandSpec<RotateParams> = {
  id: 'components.rotate',
  title: 'components.rotate',
  params: RotateSchema,
  run(doc, params) {
    const board = placedBoard(doc, params.id);
    board.rotationDeg = normalizeAngle((board.rotationDeg % 360) + (params.deltaDeg % 360));
  },
};
const flipSide: CommandSpec<ComponentTargetParams> = {
  id: 'components.flipSide',
  title: 'components.flipSide',
  params: ComponentTargetSchema,
  run(doc, params) {
    const board = placedBoard(doc, params.id);
    board.side = board.side === 'top' ? 'bottom' : 'top';
  },
};
const setScale: CommandSpec<SetScaleParams> = {
  id: 'components.setScale',
  title: 'components.setScale',
  params: SetScaleSchema,
  run(doc, params) {
    const board = placedBoard(doc, params.id);
    board.scaleX = params.scaleX;
    board.scaleY = params.scaleY;
  },
};
const align: CommandSpec<AlignParams> = {
  id: 'components.align',
  title: 'components.align',
  params: AlignSchema,
  run(doc, params) {
    const board = placedBoard(doc, params.id);
    board.center = params.center;
    board.rotationDeg = normalizeAngle(params.rotationDeg);
    board.scaleX = params.scaleX;
    board.scaleY = params.scaleY;
  },
};
const setLabelOffset: CommandSpec<SetLabelOffsetParams> = {
  id: 'components.setLabelOffset',
  title: 'components.setLabelOffset',
  params: SetLabelOffsetSchema,
  run(doc, params) {
    const board = placedBoard(doc, params.id);
    if (params.offset === null) delete board.labelOffset;
    else board.labelOffset = params.offset;
  },
};

export const commands = [
  add,
  update,
  addPin,
  addOwnPin,
  renamePin,
  setNc,
  removePin,
  placeOnBoard,
  changeFootprint,
  removeFromBoard,
  rotate,
  flipSide,
  setScale,
  align,
  setLabelOffset,
];
