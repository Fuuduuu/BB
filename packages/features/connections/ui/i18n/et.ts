export const connectionsEt = {
  title: 'Ühendused',
  airLines: 'Õhujooned',
  junctionEnd: 'liitepunkt',
  junction: (count: number) => `Liitepunkt · ${count} ${count === 1 ? 'ühendus' : 'ühendust'}`,
  drawOnBoard: 'Joonista rada fotol',
  removeBoardDrawing: 'Eemalda joonistus',
  deleteConnection: 'Kustuta ühendus',
  deleteJunction: (count: number) =>
    `Kustuta liitepunkt (${count} ${count === 1 ? 'ühendus' : 'ühendust'})`,
  traceTool: 'Rada',
  traceTop: 'Rada · pealmine',
  traceBottom: 'Rada · alumine',
  traceWire: 'Juhe',
  traceLayerMismatch: 'Ots ei sobi valitud kihiga',
  traceFailed: 'Raja salvestamine ebaõnnestus',
  traceLength: (length: number) =>
    `${length.toLocaleString('et', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })} mm`,
} as const;
