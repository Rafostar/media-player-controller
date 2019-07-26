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
		mpv.command(['observe_property', 5, 'eof-reached']);
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

	cyclePause: (cb) =>
	{
		cb = cb || noop;

		mpv.command(['cycle', 'pause'], (err) =>
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

	cycleVideo: (cb) =>
	{
		cb = cb || noop;

		mpv.command(['cycle', 'video'], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	cycleAudio: (cb) =>
	{
		cb = cb || noop;

		mpv.command(['cycle', 'audio'], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	cycleSubs: (cb) =>
	{
		cb = cb || noop;

		mpv.command(['cycle', 'sub'], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	setFullscreen: (isEnabled, cb) =>
	{
		cb = cb || noop;

		switch(isEnabled)
		{
			case false:
			case 'no':
				isEnabled = 'no';
				break;
			default:
				isEnabled = 'yes';
				break;
		}

		mpv.command(['set_property', 'fullscreen', isEnabled], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	cycleFullscreen: (cb) =>
	{
		cb = cb || noop;

		mpv.command(['cycle', 'fullscreen'], (err) =>
		{
			if(err) return cb(err);
			return cb(null);
		});
	},

	keepOpen: (value, cb) =>
	{
		cb = cb || noop;

		switch(value)
		{
			case true:
			case 'yes':
				value = 'yes';
				break;
			case 'always':
				value = 'always';
				break;
			default:
				value = 'no';
				break;
		}

		mpv.command(['set_property', 'keep-open', value], (err) =>
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
