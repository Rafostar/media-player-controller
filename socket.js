const fs = require('fs');
const debug = require('debug')('mpc:socket');
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
	debug('Connecting to UNIX socket...');

	if(!fs.existsSync(ipcPath))
	{
		fs.writeFileSync(ipcPath);
		debug(`Created new socket file: ${ipcPath}`);
	}

	socket.setEncoding('utf8');
	socket.setNoDelay(true);
	socket.connected = false;

	timeout = setTimeout(() =>
	{
		timeout = null;
		socket.removeListener('connect', onConnect);
		socket.removeListener('error', onError);

		var errMsg = 'Socket connect timeout';
		debug(errMsg);

		cb(new Error(errMsg));
	}, 10000);

	const onConnect = function()
	{
		if(!timeout) return;

		clearTimeout(timeout);
		timeout = null;

		socket.connected = true;
		socket.once('close', onDisconnect);

		debug('Socket connected');
		cb(null);
	}

	const onDisconnect = function()
	{
		socket.connected = false;
		socket.removeListener('error', onError);
	}

	const onError = function(err)
	{
		debug(err);

		if(!socket.connecting)
			socket.connect(ipcPath);
	}

	socket.once('connect', onConnect);
	socket.on('error', onError);

	var accessDone = false;

	var watcher = fs.watch(ipcPath, (eventType) =>
	{
		debug('Player accessed socket event: ' + eventType);

		if(eventType === 'change')
			return;
		else if(!accessDone)
			return accessDone = true;

		watcher.close();
		socket.connect(ipcPath);

		debug('File watcher closed');
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
