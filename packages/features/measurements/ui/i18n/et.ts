import type { EngineError } from '@pcbk/contracts';

export const measurementListText = {
  tab: 'Mõõtmised',
  empty: 'Vali jalg ja sisesta väärtus. Esimene mõõtmine on tavaliselt toitesisend GND suhtes.',
  removedContact: 'kontakt kustutatud',
  remove: 'Kustuta mõõtmine',
  removeLabel: (value: string, pair: string) => `Kustuta mõõtmine ${value} ${pair}`,
  overload: 'OL',
  unavailable: '—',
  modes: { resistance: 'Takistus', diode: 'Diood', continuity: 'Läbivus' },
  beepResult: { yes: 'piiksub', no: 'ei piiksu' },
} as const;

export const measureEt = {
  title: 'Mõõda',
  list: { title: measurementListText.tab },
  summary: (count: number) =>
    count === 0 ? null : `${count} ${count === 1 ? 'mõõtmine' : 'mõõtmist'}`,
  redProbe: 'Punane sond',
  blackProbe: 'Must sond',
  pickBlack: 'Vali musta sondi jalg',
  pickingBlack: 'Klõpsa plaadil musta sondi jalal',
  boardReading: (value: string, refLabel: string, powerLabel: string) =>
    `Plaadil: ${value} · must ${refLabel} · toide ${powerLabel.toLowerCase()}`,
  lastSaved: 'Viimati salvestatud',
  pinMeasurements: 'Mõõtmised',
  pinMeasurementsEmpty: 'Selle jalaga mõõtmisi pole.',
  unset: 'määramata',
  missingContact: '—',
  pickRef: 'Vali jalg',
  clearRef: 'Tühjenda',
  power: 'Toide',
  powerLabels: { unknown: 'Teadmata', on: 'Sees', off: 'Väljas' },
  mode: 'Režiim',
  modes: { voltage: 'Pinge', continuity: 'Läbivus' },
  modeKeys: 'Alt+1 pinge · Alt+4 läbivus',
  beeps: 'Piiksub',
  noBeep: 'Ei piiksu',
  beepKeys: 'Enter piiksub · Alt+N ei piiksu',
  needRef: 'Vali vastaspunkt',
  voltage: 'Pinge',
  hint: 'nt 4,98',
  save: 'Salvesta',
  pinKeys: 'Alt+↓ järgmine jalg · Alt+↑ eelmine',
  emptyVoltage: 'Sisesta pinge, nt 4,98.',
  invalidVoltage: 'Ei saa aru. Sisesta pinge voltides, nt 4,98 või 3m3.',
  missingAt: 'Mõõtmiskoha jalg on kustutatud. Vali uus jalg.',
  missingRef: 'Vastaspunkti jalg on kustutatud. Vali uus või tühjenda.',
  errors: {
    readOnly: 'Projekt on kirjutuskaitstud.',
    missing: 'Mõõtmist või jalga ei leitud.',
    invalid: 'Kontrolli mõõtmise andmeid.',
    sameProbe: 'Vali vastaspunktiks teine jalg.',
    failed: 'Mõõtmist ei saanud muuta. Proovi uuesti.',
  },
} as const;

export const beepEt = {
  tool: 'Piiks',
  anchorLabel: (ref: string) => `Must sond · ${ref}`,
  hintStart: 'Klõpsa jalal, kus on must sond',
  hintNext: 'Klõpsa jalal, mida punane sond puudutab · Shift+klõps: uus must sond · Esc lõpetab',
  connect: 'Piiksub ja ühenda',
  measureOnly: 'Ainult mõõtmine',
  noBeep: 'Ei piiksu',
  throughComponent: (refs: readonly string[]) =>
    `Piiksub läbi komponendi ${refs.join(', ')}. Ühendan ikkagi?`,
  roleMerge: (roles: readonly string[]) =>
    `Ühendamine liidaks võrgud ${roles.join(' ja ')}. Ühendan ikkagi?`,
  connectAnyway: 'Ühenda ikkagi',
  keepApart: 'Jäta ühendamata',
  measureAgain: 'Mõõda uuesti',
  measureWithBeep: 'Mõõda piiksuga',
} as const;

export function commandError(error: EngineError): string {
  switch (error.code) {
    case 'internal':
      return 'Sisemine viga, muudatust ei tehtud. Salvesta diagnostika ja anna veast teada.';
    case 'validation':
      if (error.issues.some(({ message }) => message === 'same_probe_twice')) {
        return measureEt.errors.sameProbe;
      }
      return measureEt.errors.invalid;
    case 'not_found':
      return measureEt.errors.missing;
    case 'read_only':
      return measureEt.errors.readOnly;
    default:
      return measureEt.errors.failed;
  }
}
