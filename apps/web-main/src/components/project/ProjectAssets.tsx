import { Project, ProjectAsset as Asset, getProjectAssets } from '@data-access';
import { useSession } from '../../app/context/SessionContext';
import { useEffect, useState } from 'react';
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@design-system';
import Link from 'next/link';
import { DownloadIcon } from 'lucide-react';

export const ProjectAssets = ({ project }: { project: Project | null }) => {
  const { apiClient: client } = useSession();
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    if (!project || !client) {
      return;
    }
    const fetchAssets = async () => {
      const assets = await getProjectAssets({
        client,
        projectUuid: project.uuid,
      });
      setAssets(assets);
    };

    fetchAssets();
  }, [project, client]);

  return (
    <div className="lg:w-1/2 w-full flex flex-col px-4">
      <div className="pb-4 flex flex-row justify-between">
        <span className="text-xl font-semibold">Assets</span>
        <Button
          variant="outline"
          className="rounded-full"
          disabled={!assets.length}
        >
          Add Asset
        </Button>
      </div>
      {assets.length ? (
        <div className="overflow-hidden rounded-2xl shadow-md border overflow-y-scroll">
          <Table>
            <TableHeader className="sticky top-0 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead>File Type</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead className="w-16">{''}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.uuid}>
                  <TableCell>
                    <div className="font-semibold">
                      {asset.filename.split('.').slice(-1)[0]}
                    </div>
                  </TableCell>
                  <TableCell>{asset.filename}</TableCell>
                  <TableCell className="w-16">
                    <Link
                      href={asset.url}
                      target="_blank"
                      className="flex flex-row gap-2 text-ochre"
                    >
                      <DownloadIcon className="size-4 mt-0.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Skeleton className="w-full h-full" />
      )}
    </div>
  );
};
