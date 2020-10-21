const hello = require('./hello.gr');

hello().then(function(result) {
  document.getElementById('root').innerHTML = result;
});
