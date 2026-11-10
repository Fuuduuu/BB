import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect } from 'vitest';
import { EngineProvider, useSnapshot } from '@pcbk/client';
import type { IdGen } from '@pcbk/contracts';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, MeasuredPin } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { createEngine } from '@pcbk/engine';
import { AppShell, Canvas, UiRegistry, useSessionStore, useViewStore } from '@pcbk/ui';
import type { UiModule } from '@pcbk/ui';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { idGenerator } from '../../__tests__/helpers';
import { engineFeatures, RESERVED_FIELDS } from '../../engine';
import { uiFeatures } from '../../ui';

const componentId = 'cmp_u1';
const view = { zoom: 1, pan: { x: 0, y: 0 } };
const noop = () => {};

export function pinRef(pinId: string): MeasuredPin {
  return { c: componentId, p: pinId, uid: `pin_u1_${pinId}` };
}

export function measurementDoc(): BoardDoc {
  const doc = newBoardDoc('Mõõtmise proov');
  doc.scale.pxPerMm = 10;
  doc.components.push({
    id: componentId,
    ref: 'U1',
    kind: 'connector',
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: ['1', '2', '3', '4'].map((id) => ({
      id,
      uid: pinRef(id).uid,
      nc: false,
      ...(id === '1' ? { name: 'VIN' } : id === '4' ? { name: 'GND' } : {}),
    })),
    board: {
      footprint: 'header1',
      params: { pins: 4, pitch: 2.54 },
      center: { x: 160, y: 100 },
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    },
  });
  return doc;
}

type Options = {
  readOnly?: boolean;
  seed?: (doc: BoardDoc) => void;
  pinnedRender?: (ids: IdGen) => ReactNode;
};

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
  useViewStore.getState().reset();
});

export function pointer(svg: SVGSVGElement, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(svg, event);
}

export function mountMeasurements({ readOnly, seed, pinnedRender }: Options = {}) {
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-10T10:00:00.000Z' },
  });
  const doc = measurementDoc();
  seed?.(doc);
  host.load('measurement-test', doc, readOnly ?? false);
  const ids = idGenerator();
  const modules: UiModule[] = uiFeatures(ids, noop);
  const measurements = modules.find((module) => module.id === 'measurements');
  if (pinnedRender && measurements?.contextPinned) {
    measurements.contextPinned = measurements.contextPinned.map((entry) => ({
      ...entry,
      render: () => pinnedRender(ids),
    }));
  }
  const registry = new UiRegistry(modules);
  const layers = registry.canvasLayers();
  const tools = registry.tools();
  const keys = registry.keys();
  function Board() {
    const snapshot = useSnapshot((value) => value);
    return (
      <Canvas
        layers={layers}
        tools={tools}
        keys={keys}
        sceneTransform="none"
        view={view}
        onViewChange={noop}
        snapshot={snapshot}
        execute={engine.execute}
      />
    );
  }
  const mounted = render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell
        registry={registry}
        canvas={<Board />}
        onRetrySave={noop}
        onSaveElsewhere={noop}
        onCopyAndReload={noop}
        onExportDiagnostics={noop}
      />
    </EngineProvider>,
  );
  const prepared = new WeakSet<SVGSVGElement>();
  function activeSvg() {
    const scene = mounted.container.querySelector('[data-scene]')!;
    const svg = scene.closest('svg')!;
    if (prepared.has(svg)) return svg;
    let captured: number | undefined;
    Object.defineProperties(svg, {
      setPointerCapture: {
        value: (id: number) => {
          captured = id;
        },
      },
      hasPointerCapture: { value: (id: number) => captured === id },
      releasePointerCapture: {
        value: () => {
          captured = undefined;
        },
      },
    });
    Object.defineProperty(scene, 'getScreenCTM', {
      value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
    });
    prepared.add(svg);
    return svg;
  }
  function pinPoint(pinId: string) {
    const { doc } = engine.snapshot();
    const component = doc.components.find(({ id }) => id === componentId);
    if (!component?.board) throw new Error('The test component has no board placement');
    const pad = boardPads(
      component.board,
      component.pins.map(({ id }) => id),
      doc.scale.pxPerMm,
    ).find(({ pinId: id }) => id === pinId);
    expect(pad).toBeDefined();
    return pad!.at;
  }
  function click(x: number, y: number) {
    const svg = activeSvg();
    pointer(svg, 'pointerdown', x, y);
    pointer(svg, 'pointerup', x, y);
  }
  return {
    ...mounted,
    engine,
    host,
    registry,
    get svg() {
      return activeSvg();
    },
    pinPoint,
    clickPin(pinId: string) {
      const { x, y } = pinPoint(pinId);
      click(x, y);
    },
    clickBlank: () => click(500, 300),
  };
}
