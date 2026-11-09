import { createContext, createElement, useContext, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import type { DocumentEngine, ProjectService } from '@pcbk/contracts';

type Services = { engine: DocumentEngine; projects: ProjectService };
const ServicesContext = createContext<Services | null>(null);

export function EngineProvider({ engine, projects, children }: PropsWithChildren<Services>) {
  const value = useMemo(() => ({ engine, projects }), [engine, projects]);
  return createElement(ServicesContext.Provider, { value }, children);
}
function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('missing_engine_provider');
  return services;
}
export const useEngine = (): DocumentEngine => useServices().engine;
export const useProjects = (): ProjectService => useServices().projects;
