'use client';

import {
  Project,
  ProjectAsset,
  ProjectContributor,
  ProjectStageDetail,
} from '@data-access';
import {
  Button,
  H2,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@design-system';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { StageChip } from '../ui/StageChip';
import Link from 'next/link';
import { camelCaseToHuman } from '@lib-utils';

export type ProjectPageProps = {
  project: Project;
  stages: ProjectStageDetail[];
  assets: ProjectAsset[];
  contributors: ProjectContributor[];
};

export const Placeholder = () => (
  <span className="text-muted-foreground">{'<none>'}</span>
);

export const ProjectPage = ({
  project,
  stages,
  assets,
  contributors,
}: ProjectPageProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const backPath = pathname.split('/').slice(0, -1).join('/');

  const { title, toh } = project;
  stages.sort((a, b) => b.stage.date.getTime() - a.stage.date.getTime());

  return (
    <div className="w-full">
      <div className="pt-4">
        <Button
          className="pl-0 text-ochre hover:bg-transparent hover:cursor-pointer"
          variant="ghost"
          onClick={() => router.push(backPath)}
        >
          <ArrowLeftIcon />
          Back to Projects
        </Button>
      </div>
      <div>
        <H2 className="flex flex-row mt-0">
          <span className="uppercase text-muted-foreground">{toh}</span>
          <div className="flex flex-col justify-center">
            <span className="px-4 text-ochre text-2xl">-</span>
          </div>
          <span className="truncate">{title}</span>
        </H2>
      </div>
      <div className="pt-8 pb-4 lg:flex flex-row gap-8">
        <div className="lg:w-1/2 w-full lg:h-[600px] flex flex-col pb-8">
          <div className="pb-4 flex flex-row justify-between">
            <span className="text-2xl font-semibold">Project Stages</span>
            <Button variant="outline" className="rounded-full">
              Set Next Stage
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border flex-1 overflow-y-scroll">
            <Table>
              <TableHeader className="sticky top-0 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Stage</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="w-16">{''}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((stage) => (
                  <TableRow key={stage.uuid}>
                    <TableCell>
                      <StageChip stage={stage.stage} />
                    </TableCell>
                    <TableCell>
                      {stage.stage.date.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {stage.stage.targetDate?.toLocaleDateString() || (
                        <Placeholder />
                      )}
                    </TableCell>
                    <TableCell className="w-16">
                      <MoreHorizontalIcon className="text-ochre" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="lg:w-1/2 w-full flex flex-col gap-8 pb-8">
          <div className="flex flex-col gap-2">
            <span className="text-md font-semibold">Notes</span>
            <div className="bg-muted/50 border rounded-lg p-4 text-sm/7 h-[250px] overflow-y-scroll">
              {project.notes}
            </div>
          </div>
          <div className="bg-muted/50 border rounded-lg p-4 flex-1">
            <div className="pb-4 flex flex-row justify-between">
              <span className="text-2xl font-semibold">Project Settings</span>
              <Button variant="outline" className="rounded-full">
                Edit
              </Button>
            </div>
            <div className="flex flex-row gap-8 pb-8">
              <div className="flex flex-col w-1/2 gap-2">
                <span className="font-semibold">Main Translator</span>
                <span>{project.translator}</span>
              </div>
              <div className="flex flex-col w-1/2 gap-2">
                <span className="font-semibold">Translation Group</span>
                <span>{project.translationGroup}</span>
              </div>
            </div>
            <div className="flex flex-row gap-8">
              <div className="flex flex-col w-1/2 gap-2">
                <span className="font-semibold">Grant Agreement Number</span>
                <span>{project.contractId}</span>
              </div>
              <div className="flex flex-col w-1/2 gap-2">
                <span className="font-semibold">Grant Agreement Date</span>
                <span>{project.contractDate?.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-2xl font-semibold pb-6">All Stages</div>
        <div className="bg-muted/50 border rounded-lg p-2">
          <div className="py-4 lg:flex flex-row gap-2">
            <div className="lg:w-1/2 w-full flex flex-col px-4 lg:pb-0 pb-8">
              <div className="pb-4 flex flex-row justify-between">
                <span className="text-xl font-semibold">Contributors</span>
                <Button variant="outline" className="rounded-full">
                  Add Contributor
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border flex-1 overflow-y-scroll">
                <Table>
                  <TableHeader className="sticky top-0 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="w-16">{''}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contributors.map((contributor) => (
                      <TableRow key={contributor.uuid}>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <div className="font-semibold">
                              {contributor.name}
                            </div>
                            <div className="text-muted-foreground">
                              {camelCaseToHuman(contributor.role)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contributor.startDate?.toLocaleDateString() || (
                            <Placeholder />
                          )}
                        </TableCell>
                        <TableCell>
                          {contributor.endDate?.toLocaleDateString() || (
                            <Placeholder />
                          )}
                        </TableCell>
                        <TableCell className="w-16">
                          <span className="flex flex-row gap-2 text-ochre">
                            Edit
                            <ArrowRightIcon className="size-4 mt-0.5" />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="lg:w-1/2 w-full flex flex-col px-4">
              <div className="pb-4 flex flex-row justify-between">
                <span className="text-xl font-semibold">Assets</span>
                <Button variant="outline" className="rounded-full">
                  Add Asset
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border flex-1 overflow-y-scroll">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
