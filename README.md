# Grain Webpack Loader

## Introduction

This is an experiment with loading the Grain programming language in Webpack.
The loader packs `.gr` files into runnable JS functions that return a promise that resolves with a string containing the result from running the Grain program.

This loader is extremely rough and mostly serves as a exploration into what compiler/runtime/lib changes are required for this to work eventually.

## Caveats

* It depends on my [feat/buffer-modules](https://github.com/z0w0/grain/tree/feat/buffer-modules) branch of Grain which adds loading modules from array buffers to the Grain runtime.
* It's pretty much only just working.
* The Grain runtime is injected with every `.gr` file that gets loaded at the moment.
* It currently loads Grain files directly, compiles them to WASM and then injects the binary as an array buffer, in a similar way to [wasm-loader](https://github.com/ballercat/wasm-loader).
  The `stdlib` is also injected this way as statically loaded modules and the runtime module locator only statically loads the `stdlib` so far.
  That means that any imports will not be found.

## Alternative implementations

Since static linking doesn't exist in Grain yet, the way this module works (turning `.gr` files directly into runnable JS) doesn't work that well
with Grain's existing implementation as imports outside of the stdlib don't work (and hence any program beyond a single Grain file is basically unusable).

Some other ideas that might work better:

1. The loader could be setup to require `wasm-loader`, and then `grain-loader` would only compile the Grain files and then `wasm-loader` would be used to load the `.wasm`.
   This should allow the URL locator built into the Grain's runtime browser to load modules properly as long as all of the wasm files are outputted to the build directory.
   This might still not be possible if we don't know what `.wasm` files to copy into the build directory.
2. The existing implementation would probably be fine if it could figure out the file tree of a compiled Grain program and then inject those statically just like the `stdlib`.
   I'm not sure if Grain outputs anything like that currently (perhaps something that could be parsed out from the compile .wasm though).
