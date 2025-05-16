import * as XLSX from 'xlsx';
import { Button } from '@design-system';
import { DownloadIcon } from 'lucide-react';
import { TableProject } from './TableProject';

export const exportSheet = async ({ rows }: { rows: TableProject[] }) => {
  const formattedRows = rows.map((r) => ({
    Toh: r.toh,
    'Work Title': r.title,
    Translator: r.translator,
    Stage: r.stage,
    Pages: r.pages,
    'Stage Date': r.stageDate,
  }));

  const sheet = XLSX.utils.json_to_sheet(formattedRows);
  sheet['!cols'] = [
    { wch: 16 },
    { wch: 100 },
    { wch: 30 },
    { wch: 5 },
    { wch: 5 },
    { wch: 12 },
  ];

  sheet['!rows'] = [{ hpt: 22 }, ...rows.map(() => ({ hpt: 20 }))];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Projects');
  XLSX.writeFile(workbook, 'projects.xlsx');
};

export const DownloadSheet = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button variant="outline" className="rounded-full" onClick={onClick}>
      Download Table
      <DownloadIcon />
    </Button>
  );
};
