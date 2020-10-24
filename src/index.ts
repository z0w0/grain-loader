import { loader } from 'webpack';
import { getOptions } from 'loader-utils';
import { validate } from 'schema-utils';
import { promisify } from 'util';
import cp from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import runtime from './runtime';
import { decode } from '@webassemblyjs/wasm-parser';

type Schema = Parameters<typeof validate>[0];

interface Logger {
  debug: (...args: any[]) => any;
}

interface ModuleFieldAST {
  type: string;
  module: string;
  name: string;
}

const schema: Schema = {
  type: 'object',
  properties: {
    grainHome: {
      type: 'string'
    },

    includeDirs: {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  }
};

const exec = promisify(cp.exec);
const exists = async (path: string) => {
  try {
    await fs.stat(path);

    return true;
  } catch (err) {
    return false;
  }
}

const compile = async (
  grainPath: string,
  sourcePath: string
): Promise<Buffer> => {
  await exec(`${grainPath} compile ${sourcePath}`);

  return fs.readFile(`${sourcePath}.wasm`);
};

const RUNTIME_MODULES = ['grainRuntime', 'grainBuiltins', 'console', 'env'];
const detectImports = async (wasm: Buffer): Promise<Set<string>> => {
  const ast = decode(wasm);
  const fields: ModuleFieldAST[] = ast.body[0].fields;

  return new Set(fields
    .filter(({ type }) => type === 'ModuleImport')
    .map(({ module }) => module.replace('GRAIN$MODULE$', ''))
    .filter(module => !RUNTIME_MODULES.includes(module)));
};

const resolveImport = async ({
  logger,
  importName,
  includeDirs
}: {
  logger: Logger,
  importName: string,
  includeDirs: string[]
}): Promise<string | undefined> => {
  for (const dir of includeDirs) {
    const checkPath = path.join(dir, `${importName}.gr.wasm`);

    logger.debug(`Checking for import ${importName} at ${checkPath}`);

    if (await exists(checkPath)) {
      logger.debug(`Resolved import ${importName} at ${checkPath}`);

      return checkPath;
    }
  }

  logger.debug(`Unresolved import ${importName}`);

  return undefined;
};

const wasmImportName = (name: string) =>
  name.includes('stdlib-external')
    ? name 
    : `GRAIN$MODULE\$${name}`;

const loadImports = async ({
  logger,
  wasm,
  loadedImports,
  includeDirs,
  addDependency
}: {
  logger: Logger,
  wasm: Buffer,
  loadedImports: Record<string, Buffer>,
  includeDirs: string[],
  addDependency: (path: string) => any
}) => {
  const foundImports = await detectImports(wasm);

  for (const importName of foundImports) {
    const wasmName = wasmImportName(importName);

    if (loadedImports[importName]) {
      continue;
    }
 
    logger.debug(`Detected import ${importName} (${wasmName})`)

    const path = await resolveImport({
      logger,
      importName,
      includeDirs
    });

    if (!path) {
      throw new Error(`Could not find required Grain import ${importName} for bundling`);
    }

    const importWasm = await fs.readFile(path);
    
    loadedImports[wasmName] = importWasm;

    logger.debug(`Loaded import ${importName} (${wasmName})`);
    addDependency(path.replace(/\.wasm$/, ''));
    await loadImports({
      logger,
      wasm: importWasm,
      loadedImports,
      includeDirs,
      addDependency
    });
  }
};

const runLoader = async ({
  logger,
  grainPath,
  grainRuntimePath,
  includeDirs,
  sourcePath,
  addDependency
}: {
  logger: Logger,
  grainPath: string,
  grainRuntimePath: string,
  includeDirs: string[],
  sourcePath: string,
  addDependency: (path: string) => any
}): Promise<string> => {
  addDependency(grainRuntimePath);
  logger.debug('Compiling Grain resource');
  
  const wasm = await compile(grainPath, sourcePath);
  const loadedImports: Record<string, Buffer> = {};
 
  logger.debug('Loading imports for compiled Grain resource');
  await loadImports({
    logger,
    wasm,
    loadedImports,
    includeDirs,
    addDependency
  });

  logger.debug('Loading runtime and returning generated code');
  
  const grainRuntime = await fs.readFile(grainRuntimePath, 'utf8');

  return runtime(grainRuntime, loadedImports, wasm);
};

const BIN_LOOKUP_PATH = 'node_modules/.bin/grain';
const RUNTIME_LOOKUP_PATH = 'runtime/dist/grain-runtime-browser.js';
const STDLIB_LOOKUP_PATH = 'stdlib';

export default function(this: loader.LoaderContext) {
  this.cacheable && this.cacheable();

  const options = getOptions(this);
  const cb = this.async();

  if (!cb) {
    throw new Error('grain-loader only works in async mode');
  }

  validate(schema, options, { name: 'Grain Loader' });

  const { includeDirs = [], grainHome } = options as Record<string, any>;
  const sourcePath = this.resourcePath;
  const grainPath = path.resolve(path.join(grainHome, BIN_LOOKUP_PATH));
  const grainRuntimePath = path.resolve(path.join(grainHome, RUNTIME_LOOKUP_PATH));
  const stdlibPath = path.resolve(path.join(grainHome, STDLIB_LOOKUP_PATH));

  runLoader({
    logger: console as any, // (this as any).getLogger ? (this as any).getLogger() : console as any,
    grainPath,
    grainRuntimePath,
    includeDirs: [path.dirname(sourcePath), ...includeDirs, stdlibPath],
    sourcePath,
    addDependency: this.addDependency.bind(this)
  })
    .then(result => cb(null, result))
    .catch(cb);
};
