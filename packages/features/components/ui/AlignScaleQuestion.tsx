import { useId, useLayoutEffect, useRef } from 'react';
import type { Snapshot } from '@pcbk/contracts';
import { Button, CanvasHudAnchor } from '@pcbk/ui';
import { selectComponent } from '../contract';
import { scaleBasisKey } from './align';
import { useAlignStore } from './align-store';
import type { AlignScaleStage } from './align-store';
import { alignEt } from './i18n/et';

type QuestionProps = { snapshot: Snapshot; onUse: () => void };

function decimal(value: number, places: number): string {
  return value.toFixed(places).replace('.', ',');
}

function scaleExplanation({ ratio, uncalibrated }: AlignScaleStage) {
  if (uncalibrated) return alignEt.scaleUncalibrated;
  if (ratio < 1) return alignEt.scaleSmaller(decimal(1 / ratio, 1));
  if (ratio > 1) return alignEt.scaleLarger(decimal(ratio, 1));
}

function QuestionPanel({ onUse, stage }: { onUse: () => void; stage: AlignScaleStage }) {
  const heading = useId();
  const primary = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => primary.current?.focus({ preventScroll: true }), []);

  const { mm, targetA, targetB } = stage;
  const proposed = Math.hypot(targetB.x - targetA.x, targetB.y - targetA.y) / mm;
  const explanation = scaleExplanation(stage);
  return (
    <CanvasHudAnchor at={targetB}>
      <div
        className="pcbk-align-question"
        role="dialog"
        data-align-question=""
        aria-labelledby={heading}
      >
        <h3 id={heading}>{alignEt.scaleQuestion}</h3>
        {explanation && <p>{explanation}</p>}
        <p>{alignEt.scaleResult(decimal(proposed, 2))}</p>
        <div className="pcbk-align-question__actions">
          <Button ref={primary} variant="primary" onClick={onUse}>
            {alignEt.useAsScale}
          </Button>
          <Button onClick={() => useAlignStore.getState().reset()}>{alignEt.keepAsIs}</Button>
        </div>
      </div>
    </CanvasHudAnchor>
  );
}

export function AlignScaleQuestion({ snapshot, onUse }: QuestionProps) {
  const stage = useAlignStore((store) => store.stage);
  const board = stage.step === 5 ? selectComponent(snapshot, stage.id)?.board : undefined;
  const basisChanged = stage.step === 5 && (!board || scaleBasisKey(board) !== stage.basis);
  useLayoutEffect(() => {
    if (basisChanged) useAlignStore.getState().reset();
  }, [basisChanged]);
  return stage.step === 5 && !basisChanged ? <QuestionPanel onUse={onUse} stage={stage} /> : null;
}
