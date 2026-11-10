import type { BoardDoc, MeasuredPin } from '@pcbk/domain';
import { CommandTargetNotFound } from '@pcbk/engine';
import type { CommandSpec } from '@pcbk/engine';
import { selectComponent } from '../../components/contract';
import { AddMeasurementSchema, RemoveMeasurementSchema } from '../contract';
import type { AddMeasurementParams, RemoveMeasurementParams } from '../contract';

function pinLabel(doc: BoardDoc, { c, p, uid }: MeasuredPin): string {
  const component = selectComponent({ doc }, c);
  if (!component || !component.pins.some((pin) => pin.id === p && pin.uid === uid)) {
    throw new Error('pin_not_active');
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
    if (params.at.uid === params.ref?.uid) throw new Error('same_probe_twice');

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

export const commands = [add, remove];
