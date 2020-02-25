const fs = require('fs');
const helper = require('./helper');
const noop = () => {};

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
				socket.connected = true;
				cb(null);
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

	var timeout = setTimeout(() => cb(new Error('Socket connection timeout')), 10000);

	const onConnect = function()
	{
		clearTimeout(timeout);
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
