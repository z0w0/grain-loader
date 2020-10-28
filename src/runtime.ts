const wasmToString = (wasm: Buffer) => {
  let list = '';

  for (let i = 0; i < wasm.length; i++) {
    list += `${wasm[i]},`
  }

  return `(function() {
    var buffer = new ArrayBuffer(${wasm.length});
    var uint8 = new Uint8Array(buffer);
    
    uint8.set([${list}]);

    return buffer;
  })()`;
}

export default (grainRuntime: string, modules: Record<string, Buffer>, wasm: Buffer) => {
  return `
    ${grainRuntime}

    var grainModules = {}; 
    var runner = Grain.buildGrainRunner(function(name) {
      return grainModules[name];
    });

    ${Object.keys(modules).map(name => `
      grainModules[${JSON.stringify(name)}] = runner.loadBuffer(${wasmToString(modules[name])})
    `)}

    module.exports = function(imports) {
      if (imports && runner.addJSImports) runner.addJSImports(imports);

      return runner
        .runBufferUnboxed(${wasmToString(wasm)})
        .then(function(result) {
          return Grain.grainToString(runner, result);
        });
    };
  `;
}
