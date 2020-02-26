const fs = require('fs');
const helper = require('./helper');
const noop = () => {};

var timeout;

module.exports =
{
	connect: function(socket, opts, cb)
	{
		cb = cb || noop;

		switch(socket._connectType)
		{
			case 'socket':
				connectUnix(socket, opts.ipcPath, cb);
				break;
			case 'web':
				connectWeb(socket, opts.httpPort, cb);
				break;
			default:
				cb(new Error(`Unsupported connection: ${connMethod}`));
				break;
		}
	},

	disconnect: function(socket, opts, cb)
	{
		cb = cb || noop;

		switch(socket._connectType)
		{
			case 'socket':
				disconnectUnix(socket, opts.ipcPath, cb);
				break;
			case 'web':
				disconnectWeb();
				socket.connected = false;
				cb(null);
				break;
			default:
				cb(new Error(`Unsupported disconnection: ${connMethod}`));
				break;
		}
	}
}

function connectUnix(socket, ipcPath, cb)
{
	if(!fs.existsSync(ipcPath))
		fs.writeFileSync(ipcPath);

	socket.setEncoding('utf8');
	socket.setNoDelay(true);
	socket.connected = false;

	timeout = setTimeout(() =>
	{
		timeout = null;
		cb(new Error('Socket connect timeout'));
	}, 10000);

	const onConnect = function()
	{
		clearTimeout(timeout);
		timeout = null;

		socket.connected = true;
		cb(null);
	}

	const onDisconnect = function()
	{
		socket.connected = false;
	}

	const onError = function()
	{
		if(!socket.connecting)
			socket.connect(ipcPath);
	}

	socket.once('connect', onConnect);
	socket.once('close', onDisconnect);
	socket.on('error', onError);

	var watcher = fs.watch(ipcPath, () =>
	{
		watcher.close();
		socket.connect(ipcPath);
	});
}

function disconnectUnix(socket, ipcPath, cb)
{
	if(timeout)
	{
		clearTimeout(timeout);
		timeout = null;
	}

	if(socket && !socket.destroyed)
	{
		socket.removeAllListeners('error');
		socket.destroy();
		socket.connected = false;
		socket.destroyed = true;
	}

	fs.access(ipcPath, fs.constants.F_OK, (err) =>
	{
		if(err) return cb(err);

		fs.unlink(ipcPath, cb);
	});
}

function connectWeb(socket, httpPort, cb)
{
	timeout = setTimeout(() => timeout = null, 10000);

	waitWebServer = function()
	{
		helper.httpRequest({ nodebug: true, port: httpPort }, err =>
		{
			if(err && timeout)
				return setTimeout(() => waitWebServer(), 500);
			else if(err)
				return cb(new Error('Web server connect timeout'));

			/* When retry is true timeout is not finished */
			if(timeout)
			{
				clearTimeout(timeout);
				timeout = null;
			}

			socket.connected = true;
			cb(null);
		});
	}

	waitWebServer();
}

function disconnectWeb()
{
	if(!timeout) return;

	clearTimeout(timeout);
	timeout = null;
}
