export const netsEt = {
  title: 'Võrgud',
  removedLabel: (name?: string) =>
    `${name ? `Võrgusilt ${name} eemaldati` : 'Võrgusilt eemaldati'} · Ctrl+Z toob tagasi`,
  removedLabels: (count: number) => `${count} võrgusilti eemaldati · Ctrl+Z toob tagasi`,
} as const;
