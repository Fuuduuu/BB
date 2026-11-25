import { useId, useLayoutEffect, useRef } from 'react';
import { pinSpacingMm } from '@pcbk/domain/rules';
import { Button, CanvasHudAnchor } from '@pcbk/ui';
import type { ToolApi } from '@pcbk/ui';
import { selectComponent } from '../contract';
import { useAlignStore } from './align-store';
import type { AlignScaleStage } from './align-store';
import { alignEt } from './i18n/et';

type QuestionProps = { api: ToolApi; onUse: () => void };

function decimal(value: number, places: number): string {
  return value.toFixed(places).replace('.', ',');
}

function scaleExplanation({ ratio, uncalibrated }: AlignScaleStage) {
  if (uncalibrated) return alignEt.scaleUncalibrated;
  if (ratio < 1) return alignEt.scaleSmaller(decimal(1 / ratio, 1));
  if (ratio > 1) return alignEt.scaleLarger(decimal(ratio, 1));
}

function QuestionPanel({ api, onUse, stage }: QuestionProps & { stage: AlignScaleStage }) {
  const heading = useId();
  const primary = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => primary.current?.focus({ preventScroll: true }), []);

  const { id, pinA, pinB, targetA, targetB } = stage;
  const board = selectComponent(api.snapshot(), id)?.board;
  const mm = board && pinSpacingMm(board, pinA, pinB);
  const proposed = mm ? Math.hypot(targetB.x - targetA.x, targetB.y - targetA.y) / mm : undefined;
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
        {proposed !== undefined && <p>{alignEt.scaleResult(decimal(proposed, 2))}</p>}
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

export function AlignScaleQuestion(props: QuestionProps) {
  const stage = useAlignStore((store) => store.stage);
  return stage.step === 5 ? <QuestionPanel {...props} stage={stage} /> : null;
}
