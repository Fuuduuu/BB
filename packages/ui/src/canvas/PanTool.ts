import type { Vec2 } from '@pcbk/domain';
import { et } from '../shell/i18n/et';
import type { CanvasTool, ToolSpec } from './tools';

const PAN_ID = 'pan';

function createPanTool(panByScreen: (delta: Vec2) => void): CanvasTool {
  let previous: Vec2 | undefined;

  function moveTo(screen: Vec2): void {
    if (!previous) return;
    const x = screen.x - previous.x;
    const y = screen.y - previous.y;
    previous = screen;
    if (x !== 0 || y !== 0) panByScreen({ x, y });
  }

  return {
    id: PAN_ID,
    cursor: 'grab',
    onPointerDown(event) {
      previous = event.screen;
    },
    onPointerMove(event) {
      moveTo(event.screen);
    },
    onPointerUp(event) {
      moveTo(event.screen);
      previous = undefined;
    },
    onCancel() {
      previous = undefined;
    },
  };
}

export function createPanToolSpec(panByScreen: (delta: Vec2) => void): ToolSpec {
  return {
    id: PAN_ID,
    label: et.shell.panTool,
    icon: PAN_ID,
    key: 'H',
    group: 'select',
    create: () => createPanTool(panByScreen),
  };
}
