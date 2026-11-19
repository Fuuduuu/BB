export const connectionsEt = {
  title: 'Ühendused',
  airLines: 'Õhujooned',
  junctionEnd: 'liitepunkt',
  junction: (count: number) => `Liitepunkt · ${count} ühendust`,
  deleteConnection: 'Kustuta ühendus',
  deleteJunction: (count: number) => `Kustuta liitepunkt (${count} ühendust)`,
} as const;
