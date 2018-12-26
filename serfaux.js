const http = require('http');
const httpProxy = require('http-proxy');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 82 });

let ws;
wss.on('connection', function connection(_ws) {
  ws = _ws;
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
  });
});

//
// Create a proxy server with custom application logic
//
const proxy = httpProxy.createProxyServer({
  changeOrigin: true
});

proxy.on('proxyRes', function (proxyRes, req, res) {
  let body;
  proxyRes.on('data', function (data) {
      body = body ? Buffer.concat([body, data], 2) : Buffer.from(data);
  });
  proxyRes.on('end', function () {
      body = body.toString();
      console.log("res from proxied server (" + req._serfauxId + "):", body);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'proxyResponse',
          id: req._serfauxId,
          // headers
          body,
        }));
      }
  });
});

let i = 0;
//
// Create your custom server and just call `proxy.web()` to proxy
// a web request to the target passed in the options
// also you can use `proxy.ws()` to proxy a websockets request
const server = http.createServer(function(req, res) {
  console.log(req.url);
  req._serfauxId = i++;
  // You can define here your custom logic to handle the request
  // and then proxy the request.
  proxy.web(req, res, {
    target: 'http://api.coindesk.com/'
  });

  if (ws) {
    ws.send(JSON.stringify({
      type: 'proxyRequest',
      id: req._serfauxId,
      url: req.url,
    }));
  }
});

console.log("Serfauxing at localhost:80")
server.listen(80);

dashboard = http.createServer(function(req, res) {
  console.log(req.url);
  res.end(`
<html>
<head>
<title>Serfaux Dashboard</title>
</head>
<body>
<script>
var host = window.document.location.host.replace(/:.*/, '');
var ws = new WebSocket('ws://' + host + ':82');
ws.onmessage = function (event) {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'proxyRequest':
      const tr = document.createElement('tr');
      tr.id = 'request-' + msg.id;
      tr.innerHTML = '<td>' + msg.url + '</td><td>Pending...</td><td><button type="button">Save</button></td>';
      const tbody = document.getElementById('requests-tbody');
      tbodyChild = tbody.firstChild;
      if (tbodyChild) {
        tbody.insertBefore(tr, tbodyChild);
      } else {
        tbody.appendChild(tr);
      }
      break;
    case 'proxyResponse':
      const row = document.getElementById('request-' + msg.id);
      row.childNodes[1].innerHTML = 'Received.';
      break;
  }
};
</script>
<table>
  <thead>
    <tr>
      <th scope="col">URL</th>
      <th scope="col">Status</th>
      <th scope="col">Action</th>
    </tr>
  </thead>
  <tbody id="requests-tbody">
  </tbody>
</table>
</body>
</html>`);
});

console.log("Dashboard at localhost:81")
dashboard.listen(81);