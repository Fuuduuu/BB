export const schematicEt = {
  title: 'Skeem',
  rotateClockwise: 'Pööra +90°',
  rotateCounterclockwise: 'Pööra −90°',
  mirror: 'Peegelda',
  remove: 'Eemalda skeemilt',
  showOnSchematic: 'Näita skeemil',
  showOnBoard: 'Näita plaadil',
  unidentifiedMark: ' ?',
  pinFunction: {
    title: 'Jalgade funktsioon',
    countMismatch: (contacts: number, pins: number) =>
      `Sümbolil on ${contacts} kontakti, komponendil ${pins} jalga. Skeemil on see kastina.`,
    contact: (contact: string) => `Kontakt ${contact}`,
    unassigned: '—',
    pin: (id: string, name?: string) => (name ? `${id} · ${name}` : id),
    ambiguous: 'Jalgade nimed ei anna funktsiooni üheselt. Skeemil on komponent kastina.',
    save: 'Salvesta',
    useNames: 'Kasuta jalgade nimesid',
  },
} as const;
