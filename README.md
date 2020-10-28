# Grain Webpack Loader

## Introduction

This is an experiment with loading the Grain programming language in Webpack.
The loader packs `.gr` files into runnable JS functions that return a promise that resolves with a string containing the result from running the Grain program.

This loader is extremely rough and mostly serves as a exploration into what compiler/runtime/lib changes are required for this to work eventually.

## Caveats

- The Grain runtime is injected with every `.gr` file that gets loaded at the moment.
- All dependencies of a single Grain file are included in the bundled code rather than required separately.

## Alternative implementations

Since static linking doesn't exist in Grain yet, the way this loader works (turning `.gr` files directly into runnable JS) requires hackily finding
dependencies by parsing out the module imports of the compiled Grain WASM and then recursively injecting all module imports required as part of the outputted JS code.

Some other ideas that might work better:

1. The loader could be setup to require `wasm-loader`, and then `grain-loader` would only compile the Grain files and then `wasm-loader` would be used to load the `.wasm`.
   This should allow the URL locator built into the Grain's runtime browser to load modules properly as long as all of the wasm files are outputted to the build directory.
2. The existing implementation would probably be fine if Grain had some sort of linking metadata and then we could confidently inject those modules rather than the hacky "linking" done by this load.
