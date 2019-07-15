const net = require('net');
const noop = () => {};

var mpv =
{
	init: (opts) =>
	{
		mpv.socket = net.createConnection(opts.ipcPath);
		mpv.socket.setEncoding('utf8');
		mpv.command(['observe_property', 1, 'time-pos']);
		mpv.command(['observe_property', 2, 'volume']);
		mpv.command(['observe_property', 3, 'pause']);
		mpv.command(['observe_property', 4, 'duration']);
	},

	socket: null,

	getSpawnArgs: (opts) =>
	{
		if(!Array.isArray(opts.playerArgs)) opts.playerArgs = [''];
		var presetArgs = [`--input-ipc-server=${opts.ipcPath}`, opts.media];

		return [ ...opts.playerArgs, ...presetArgs ];
	},

	command: (params, cb) =>
	{
		cb = cb || noop;
		var command = null;

		if(!mpv.socket || (mpv.socket && !mpv.socket.writable))
			return cb(new Error('No writable IPC socket! Playback control disallowed'));

		if(!Array.isArray(params))
			return cb(new Error('No command parameters array!'));

		try { command = JSON.stringify({ command: params }); }
		catch(err) { return cb(err); }

		mpv.socket.write(command + '\n', (err) => cb(err));
	},

	play: (cb) =>
	{
		cb = cb || noop;

		mpv.command(['set_property', 'pause', false], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	pause: (cb) =>
	{
		cb = cb || noop;

		mpv.command(['set_property', 'pause', true], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	load: (media, cb) =>
	{
		cb = cb || noop;

		mpv.command(['loadfile', media, 'replace'], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	seek: (position, cb) =>
	{
		cb = cb || noop;

		mpv.command(['seek', position, 'exact+absolute'], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	setVolume: (value, cb) =>
	{
		cb = cb || noop;

		mpv.command(['set_property', 'volume', value], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	setRepeat: (isEnabled, cb) =>
	{
		cb = cb || noop;

		switch(isEnabled)
		{
			case true:
			case 'inf':
			case 'yes':
				isEnabled = 'inf';
				break;
			default:
				isEnabled = 'no';
				break;
		}

		mpv.command(['set_property', 'loop', isEnabled], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	stop: (cb) =>
	{
		cb = cb || noop;

		mpv.command(['quit', 0], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	}
}

module.exports = mpv;
