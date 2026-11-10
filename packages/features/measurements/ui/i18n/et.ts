import type { EngineError } from '@pcbk/contracts';

export const measurementListText = {
  tab: 'Mõõtmised',
  empty: 'Vali jalg ja sisesta väärtus. Esimene mõõtmine on tavaliselt toitesisend GND suhtes.',
  removedContact: 'kontakt kustutatud',
  remove: 'Kustuta',
  overload: 'OL',
  unavailable: '—',
  modes: { resistance: 'Takistus', diode: 'Diood', continuity: 'Läbivus' },
} as const;

export const measureEt = {
  title: 'Mõõda',
  list: { title: measurementListText.tab },
  at: 'Koht',
  ref: 'Vastaspunkt',
  unset: 'määramata',
  missingContact: '—',
  pickRef: 'Vali jalg',
  clearRef: 'Tühjenda',
  power: 'Toide',
  powerLabels: { unknown: 'Teadmata', on: 'Sees', off: 'Väljas' },
  voltage: 'Pinge',
  hint: 'nt 4,98',
  save: 'Salvesta',
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

export function commandError(error: EngineError): string {
  switch (error.code) {
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
