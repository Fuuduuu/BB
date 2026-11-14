import { createContext, useContext } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { sceneTextMatrix, type SceneTransform } from './stage';

export const SceneTransformContext = createContext<SceneTransform>('none');

export function useSceneTransform(): SceneTransform {
  return useContext(SceneTransformContext);
}

type SceneTextProps = ComponentPropsWithoutRef<'text'> & {
  x: number;
  y: number;
  sceneTransform?: SceneTransform;
};

export function SceneText({ x, y, sceneTransform, transform, ...props }: SceneTextProps) {
  const inherited = useSceneTransform();
  const counterTransform = sceneTextMatrix(sceneTransform ?? inherited, { x, y });
  return (
    <text
      {...props}
      x={x}
      y={y}
      transform={transform ? `${counterTransform} ${transform}` : counterTransform}
    />
  );
}
