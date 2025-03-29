export type ProjectDTO = {
  uuid: string;
  toh: string;
  title: string;
  translator: string;
  stage: string;
  stage_date: string;
  pages: number;
};

export type Project = {
  uuid: string;
  toh: string;
  title: string;
  translator: string;
  stage: string;
  stageDate: Date;
  pages: number;
};

export function projectFromDTO(dto: ProjectDTO): Project {
  return {
    uuid: dto.uuid,
    toh: dto.toh,
    title: dto.title,
    translator: dto.translator,
    stage: dto.stage,
    stageDate: new Date(dto.stage_date),
    pages: dto.pages,
  };
}
