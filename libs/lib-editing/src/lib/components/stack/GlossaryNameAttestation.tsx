'use client';

import {
  formatAttestation,
  GLOSSARY_ATTESTATIONS,
} from '@eightyfourthousand/data-access';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@eightyfourthousand/design-system';

import type { PanelName } from './glossary-entry-names';

/** The select's value for no attestation, which Radix can't give as ''. */
const ATTESTATION_NONE = 'none';

/** A name's attestation, chosen from the known ones or none. */
export const GlossaryNameAttestation = ({
  name,
  disabled,
  onChange,
}: {
  name: PanelName;
  disabled: boolean;
  onChange: (attestation: string | null) => void;
}) => {
  const value = name.attestation ?? ATTESTATION_NONE;
  const offered: string[] = [...GLOSSARY_ATTESTATIONS];
  const stored = name.attestation;
  if (stored && !offered.includes(stored)) offered.push(stored);
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(chosen) =>
        onChange(chosen === ATTESTATION_NONE ? null : chosen)
      }
    >
      <SelectTrigger
        aria-label={`Attestation of ${name.content}`}
        className="w-56 self-start"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ATTESTATION_NONE}>No attestation</SelectItem>
        {offered.map((attestation) => (
          <SelectItem key={attestation} value={attestation}>
            {formatAttestation(attestation)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
