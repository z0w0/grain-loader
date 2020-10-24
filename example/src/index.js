const fibbonacci = require('./main.gr');

fibbonacci().then(function(result) {
  document.getElementById('root').innerHTML = result;
});
