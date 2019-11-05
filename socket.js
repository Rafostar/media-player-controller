const fs = require('fs');
const noop = () => {};

module.exports =
{
	connect: function(socket, opts, cb)
	{
		cb = cb || noop;

		connectUnix(socket, opts.ipcPath, cb);
	},

	disconnect: function(socket, opts, cb)
	{
		cb = cb || noop;

		disconnectUnix(socket, opts.ipcPath, cb);
	}
}

function connectUnix(socket, ipcPath, cb)
{
	if(!fs.existsSync(ipcPath))
		fs.writeFileSync(ipcPath);

	socket.setEncoding('utf8');
	socket.setNoDelay(true);

	const onConnect = function()
	{
		clearTimeout(timeout);
		cb(null);
	}

	const onError = function()
	{
		if(!socket.connecting)
			socket.connect(ipcPath);
	}

	socket.once('connect', onConnect);
	socket.on('error', onError);

	var watcher = fs.watch(ipcPath, () =>
	{
		watcher.close();
		socket.connect(ipcPath);
	});

	var timeout = setTimeout(() => cb(new Error('Socket connection timeout')), 10000);
}

function disconnectUnix(socket, ipcPath, cb)
{
	if(socket && !socket.destroyed)
	{
		socket.removeAllListeners('error');
		socket.destroy();
	}

	fs.access(ipcPath, fs.constants.F_OK, (err) =>
	{
		if(err) return cb(err);

		fs.unlink(ipcPath, cb);
	});
}
