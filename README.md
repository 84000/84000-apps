# 84000 Applications Monorepo

This repository contain web clients for 84000 applications.

## Start an application

As described below, all commands within this monorepo follow a well-defined pattern.

To get started, try running these commands to run the main web app locally:

```bash
# install dependencies
npm install
# run the web-main app in dev mode
npx nx dev web-main
```

> We also have a Storybook design system supporting the `design-system` library.
> Use the `nx storybook design-system` command to run it locally.

The most common commands are probably:

```bash
# Run the web-main app in dev mode. Replace 'web-main' with the name of any
# other app to run it instead
npx nx dev web-main

# Build the web-main app for production. Replace 'web-main' with the name of any
# other app to build it instead. If a preview deployment fails, start by building
# the app locally to see if there are any errors.
npx nx build web-main

# Run the design system Storybook locally
npx nx storybook design-system
```

> If you install `nx` globally, you can replace `npx nx` with just `nx` in the
> commands above.

## Vercel applications

If you are working on an application that is deployed to Vercel, you may need to
set up environment variables locally. From within the directory of the application
(such as `/apps/web-main`), start by running the command:

```bash
npx vercel env pull --environment development
```

This will create a `.env.local` file in the application directory with the necessary
environment variables. They can be overridden as needed. If you rename the file
for some reason, be sure to update the `.gitignore` file to prevent committing.

## Repo Structure

```bash
\apps
|- applications
\libs
|- shared libraries

```

As much as possible, code should be placed in `libs` and reused across multiple
applications in `apps`. Applications should be as thin as possible, focusing on
orchestrating the libraries to deliver the desired functionality.

## Build for production

Run `npx nx build frontend` to build the application. The build artifacts are
stored in the output directory (e.g. `dist/` or `build/`), ready to be deployed.

## Running tasks

To execute tasks with Nx use the following syntax:

```bash
npx nx <target> <project> <...options>
```

You can also run multiple targets:

```bash
npx nx run-many -t <target1> <target2>
```

..or add `-p` to filter specific projects

```bash
npx nx run-many -t <target1> <target2> -p <proj1> <proj2>
```

Targets can be defined in the `package.json` or `projects.json`. Learn more
[in the docs](https://nx.dev/features/run-tasks).

## Publishing packages

The monorepo now has npm packaging groundwork for these shared libraries:

- `@eightyfourthousand/lib-utils`
- `@eightyfourthousand/data-access`
- `@eightyfourthousand/client-graphql`
- `@eightyfourthousand/lib-instr`
- `@eightyfourthousand/design-system`
- `@eightyfourthousand/lib-search`
- `@eightyfourthousand/lib-editing`

Build the publishable libraries with:

```bash
npx nx run-many -t build -p lib-utils,data-access,client-graphql,lib-instr,design-system,lib-search,lib-editing
```

Version and publish with Nx release:

```bash
npm run release:version
npm run release:publish
```

To publish from GitHub Actions, configure npm Trusted Publishing for this repository and the `publish-packages.yml` workflow, then run the manual `Publish Packages` workflow. The workflow includes a `dry_run` input so you can verify the publish plan before pushing packages to npm. No `NPM_TOKEN` secret is required for CI publishing when trusted publishing is configured correctly.

For local manual publishing, use a granular npm access token with bypass 2FA enabled if your npm account uses passkeys or other non-OTP 2FA methods.

For `@eightyfourthousand/design-system`, consumers should import the theme entry explicitly:

```ts
import '@eightyfourthousand/design-system/css';
```

## Explore the project graph

Run `npx nx graph` to show the graph of the workspace.
It will show tasks that you can run with Nx.

- [Learn more about Exploring the Project Graph](https://nx.dev/core-features/explore-graph)
