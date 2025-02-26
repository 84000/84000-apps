import {
  Bibliography,
  BibliographyDTO,
  bibliographyFromDTO,
} from './bibliography';
import { Glossary, GlossaryDTO, glossaryFromDTO } from './glossary';
import { Passage, PassageDTO, passageFromDTO } from './passage';

export type EndNotes = Passage[];

export type BackMatter = {
  glossary: Glossary;
  endNotes: EndNotes;
  bibliography: Bibliography;
};

export type EndNotesDTO = PassageDTO[];

export type BackMatterDTO = {
  glossary: GlossaryDTO;
  'end-notes': EndNotesDTO;
  bibliography: BibliographyDTO;
};

export const backMatterFromDTO = (dto: BackMatterDTO): BackMatter => {
  return {
    glossary: glossaryFromDTO(dto.glossary),
    endNotes: dto['end-notes'].map(passageFromDTO),
    bibliography: bibliographyFromDTO(dto.bibliography),
  };
};
