# 84000 Applications Monorepo

This repository contain web clients for 84000 applications.

## Repo Structure

```bash
\apps
|- applications
\libs
|- shared libraries

```

## Integrate with editors

Enhance your Nx experience by installing [Nx Console](https://nx.dev/nx-console)
for your favorite editor. Nx Console provides an interactive UI to view your
projects, run tasks, generate code, and more! Available for VSCode, IntelliJ and
comes with a LSP for Vim users.

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

## Explore the project graph

Run `npx nx graph` to show the graph of the workspace.
It will show tasks that you can run with Nx.

- [Learn more about Exploring the Project Graph](https://nx.dev/core-features/explore-graph)
