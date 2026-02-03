import type { CodegenConfig } from '@graphql-codegen/cli';
import { join } from 'path';

// Resolve paths from repo root
const repoRoot = join(__dirname, '../..');
const schemaPath = join(repoRoot, 'apps/api-graphql/src/graphql/schema/**/*.graphql');
const documentsPath = join(__dirname, 'src/lib/graphql/**/*.graphql');
const outputPath = join(__dirname, 'src/lib/generated/graphql.ts');

const config: CodegenConfig = {
  schema: schemaPath,
  documents: documentsPath,
  generates: {
    [outputPath]: {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        rawRequest: false,
        inlineFragmentTypes: 'combine',
        skipTypename: false,
        exportFragmentSpreadSubTypes: true,
        dedupeFragments: true,
        enumsAsTypes: true,
        useTypeImports: true,
      },
    },
  },
  ignoreNoDocuments: false,
};

export default config;
