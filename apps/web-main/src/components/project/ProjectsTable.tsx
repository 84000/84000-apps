'use client';

import { DataTable } from '@design-system';
import { Project } from '@data-access';
import { useEffect, useState } from 'react';
import { parseToh, removeDiacritics } from '@lib-utils';
import { TableProject } from './TableProject';
import { ProjectFilters } from './ProjectFilters';
import { useProjectColumns } from './ProjectColumns';

export const ProjectsTable = ({ projects }: { projects: Project[] }) => {
  const [data, setData] = useState<TableProject[]>([]);

  useEffect(() => {
    setData(
      projects.map((p) => ({
        uuid: p.uuid,
        toh: parseToh(p.toh),
        title: p.title,
        plainTitle: removeDiacritics(p.title),
        translator: p.translator || '',
        stage: p.stage.label,
        stageDate: p.stage.date.toLocaleDateString(),
        stageObject: p.stage,
        pages: p.pages,
        canons: p.canons || '',
      })),
    );
  }, [projects]);

  const { columns } = useProjectColumns();

  return (
    <DataTable
      name="projects"
      data={data}
      columns={columns}
      visibility={{
        plainTitle: false,
        canons: false,
      }}
      sorting={[{ id: 'pages', desc: true }]}
      filters={(table) => <ProjectFilters table={table} />}
    />
  );
};
