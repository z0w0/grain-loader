const fibbonacci = require('./main.gr');

fibbonacci({
  window: {
    alert: window.alert
  }
}).then(function(result) {
  document.getElementById('root').innerHTML = result;
});
