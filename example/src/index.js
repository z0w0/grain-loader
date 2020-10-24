const fibbonacci = require('./fibonacci.gr');

fibbonacci().then(function(result) {
  document.getElementById('root').innerHTML = result;
});
