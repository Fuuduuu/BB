import type { BoardDoc, MeasuredPin } from '@pcbk/domain';
import { connectBeepPins } from '@pcbk/domain/rules';
import { CommandTargetNotFound, reject } from '@pcbk/engine';
import type { CommandSpec } from '@pcbk/engine';
import { selectComponent } from '../../components/contract';
import { AddMeasurementSchema, BeepRecordSchema, RemoveMeasurementSchema } from '../contract';
import type { AddMeasurementParams, BeepRecordParams, RemoveMeasurementParams } from '../contract';

function pinLabel(doc: BoardDoc, { c, p, uid }: MeasuredPin): string {
  const component = selectComponent({ doc }, c);
  if (!component || !component.pins.some((pin) => pin.id === p && pin.uid === uid)) {
    reject('pin_not_active');
  }
  return `${component.ref}.${p}`;
}

const add: CommandSpec<AddMeasurementParams> = {
  id: 'measurements.add',
  title: 'measurements.add',
  params: AddMeasurementSchema,
  run(doc, params) {
    const atLabel = pinLabel(doc, params.at);
    const refLabel = params.ref ? pinLabel(doc, params.ref) : undefined;
    if (params.at.uid === params.ref?.uid) reject('same_probe_twice');

    doc.measurements.push({
      ...params,
      atLabel,
      ...(refLabel === undefined ? {} : { refLabel }),
      source: 'manual',
    });
  },
};

const remove: CommandSpec<RemoveMeasurementParams> = {
  id: 'measurements.remove',
  title: 'measurements.remove',
  params: RemoveMeasurementSchema,
  run(doc, { id }) {
    const index = doc.measurements.findIndex((measurement) => measurement.id === id);
    if (index < 0) throw new CommandTargetNotFound(id);
    doc.measurements.splice(index, 1);
  },
};

const recordBeep: CommandSpec<BeepRecordParams> = {
  id: 'beep.record',
  title: 'beep.record',
  params: BeepRecordSchema,
  alsoWrites: ['connections'],
  run(doc, { measurementId, connectionId, anchor, pin, beep, connect, takenAt }, ctx) {
    const atLabel = pinLabel(doc, pin);
    const refLabel = pinLabel(doc, anchor);
    if (anchor.uid === pin.uid) reject('same_probe_twice');

    doc.measurements.push({
      id: measurementId,
      mode: 'continuity',
      at: pin,
      ref: anchor,
      beep,
      power: 'unknown',
      takenAt,
      atLabel,
      refLabel,
      source: 'beep_mode',
    });
    if (!beep || !connect) return;

    const outcome = connectBeepPins(doc, {
      anchor: { c: anchor.c, p: anchor.p },
      pin: { c: pin.c, p: pin.p },
      connectionId,
    });
    if (outcome.kind === 'guarded') {
      const { reason, components, roles } = outcome;
      ctx.emit({
        type: 'beep.guarded',
        payload: { measurementId, anchor, pin, reason, components, roles },
      });
    }
  },
};

export const commands = [add, remove, recordBeep];
