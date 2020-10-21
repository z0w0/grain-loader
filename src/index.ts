import { loader } from 'webpack';
import { getOptions, OptionObject } from 'loader-utils';
import { validate } from 'schema-utils';
import { promisify } from 'util';
import cp from 'child_process';
import tmp from 'tmp';
import { promises as fs } from 'fs';
import path from 'path';
import runtime from './runtime';
import glob from 'fast-glob';

type Schema = Parameters<typeof validate>[0];
const schema: Schema = {
  type: 'object',
  properties: {
    grainHome: {
      type: 'string'
    }
  }
};

const exec = promisify(cp.exec);
const tmpDir = () => new Promise<{ dir: string, cleanup: () => any }>((resolve, reject) => {
  tmp.dir((err: Error | null, dir: string, cleanup: () => any) => {
    if (err) return reject(err);
    
    resolve({ dir, cleanup });
  })
});

const compile = async ({
  grainPath,
  inputPath,
  outputPath,
  source
}: {
  grainPath: string;
  inputPath: string;
  outputPath: string;
  source: string;
}): Promise<Buffer> => {
  await fs.writeFile(inputPath, source, 'utf8');
  await exec(`${grainPath} ${inputPath}`);

  return fs.readFile(outputPath);
};

const loadStdlib = async (stdlibPath: string, addDependency: (path: string) => any) => {
  const wasmPaths = await glob('**/*.gr.wasm', { cwd: stdlibPath, deep: 3 });

  return wasmPaths.reduce<Promise<Record<string, Buffer>>>(
    async (result, wasmPath) => {
      const relativePath = path.join(stdlibPath, wasmPath);
      const name = wasmPath.includes('stdlib-external')
        ? `${wasmPath.replace('.gr.wasm', '')}`
        : `GRAIN$MODULE\$${path.basename(wasmPath, '.gr.wasm')}`

      addDependency(relativePath);

      return {
        ...await result,

        [name]: await fs.readFile(relativePath)
      };
    },
    Promise.resolve({})
  );
};

const runLoader = async ({
  grainPath,
  grainRuntimePath,
  stdlibPath,
  source,
  addDependency
}: {
  grainPath: string,
  grainRuntimePath: string,
  stdlibPath: string,
  source: string,
  addDependency: (path: string) => any
}): Promise<string> => {
  addDependency(grainRuntimePath);

  const { dir, cleanup } = { dir: path.join(__dirname, 'test'), cleanup: () => {} }; // await tmpDir();
  const inputPath = path.join(dir, 'src.gr');
  const outputPath = path.join(dir, 'src.gr.wasm');

  try {
    const modules = await loadStdlib(stdlibPath, addDependency);
    const grainRuntime = await fs.readFile(grainRuntimePath, 'utf8');
    const wasm = await compile({
      grainPath,
      inputPath,
      outputPath,
      source
    });

    cleanup();

    return runtime(grainRuntime, modules, wasm);
  } catch (err) {
    cleanup();
    throw err;
  }
};

const BIN_LOOKUP_PATH = 'node_modules/.bin/grain';
const RUNTIME_LOOKUP_PATH = 'runtime/dist/grain-runtime-browser.js';
const STDLIB_LOOKUP_PATH = 'stdlib';

export default function(this: loader.LoaderContext, source: string) {
  const options = getOptions(this);
  const cb = this.async();

  if (!cb) {
    throw new Error('grain-loader only works in async mode');
  }

  validate(schema, options, { name: 'Grain Loader' });

  const grainHome = options.grainHome as string;
  const grainPath = path.resolve(path.join(grainHome, BIN_LOOKUP_PATH));
  const grainRuntimePath = path.resolve(path.join(grainHome, RUNTIME_LOOKUP_PATH));
  const stdlibPath = path.resolve(path.join(grainHome, STDLIB_LOOKUP_PATH));

  runLoader({
    grainPath,
    grainRuntimePath,
    stdlibPath,
    source,
    addDependency: this.addDependency.bind(this)
  })
    .then(result => cb(null, result))
    .catch(cb);
};
