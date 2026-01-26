import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { join } from 'node:path';

const schemaDir = join(process.cwd(), 'src/graphql/schema');

// Load all .graphql files from schema directory and subdirectories
const typesArray = loadFilesSync(schemaDir, {
  extensions: ['graphql'],
  recursive: true,
});

// Merge all type definitions into a single schema
export const typeDefs = mergeTypeDefs(typesArray);
