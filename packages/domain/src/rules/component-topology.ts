import type { Component } from '../model/component';

export function componentTopology(components: readonly Component[]): readonly unknown[] {
  const topology: unknown[] = [];
  for (const { id, kind, pins } of components) topology.push(id, kind, pins);
  return topology;
}
