import { Generator, getConfig } from '@tanstack/router-generator';

const root = process.cwd();
await new Generator({ config: getConfig({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }, root), root }).run();
