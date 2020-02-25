const noop = () => {};
var prevPosition;

module.exports =
{
	init: function()
	{
		prevPosition = null;

		this.command(['observe_property', 1, 'time-pos']);
		this.command(['observe_property', 2, 'volume']);
		this.command(['observe_property', 3, 'pause']);
		this.command(['observe_property', 4, 'duration']);
		this.command(['observe_property', 5, 'eof-reached']);
	},

	_connectType: 'socket',

	_getSpawnArgs: function(opts)
	{
		if(!Array.isArray(opts.args)) opts.args = [''];
		var presetArgs = [`--input-ipc-server=${opts.ipcPath}`, opts.media];

		return [ ...opts.args, ...presetArgs ];
	},

	command: function(params, cb)
	{
		cb = cb || noop;
		var command = null;

		if(!this.writable)
			return cb(new Error('No writable IPC socket! Playback control disallowed'));

		if(!Array.isArray(params))
			return cb(new Error('No command parameters array!'));

		try { command = JSON.stringify({ command: params }); }
		catch(err) { return cb(err); }

		this.write(command + '\n', cb);
	},

	play: function(cb)
	{
		cb = cb || noop;
		this.command(['set_property', 'pause', false], cb);
	},

	pause: function(cb)
	{
		cb = cb || noop;
		this.command(['set_property', 'pause', true], cb);
	},

	cyclePause: function(cb)
	{
		cb = cb || noop;
		this.command(['cycle', 'pause'], cb);
	},

	load: function(media, cb)
	{
		cb = cb || noop;
		this.command(['loadfile', media, 'replace'], cb);
	},

	seek: function(position, cb)
	{
		cb = cb || noop;
		this.command(['seek', position, 'exact+absolute'], cb);
	},

	setVolume: function(value, cb)
	{
		cb = cb || noop;
		this.command(['set_property', 'volume', value * 100], cb);
	},

	setRepeat: function(isEnabled, cb)
	{
		cb = cb || noop;

		switch(isEnabled)
		{
			case true:
			case 'inf':
			case 'yes':
			case 'on':
				isEnabled = 'inf';
				break;
			default:
				isEnabled = 'no';
				break;
		}

		this.command(['set_property', 'loop', isEnabled], cb);
	},

	cycleVideo: function(cb)
	{
		cb = cb || noop;
		this.command(['cycle', 'video'], cb);
	},

	cycleAudio: function(cb)
	{
		cb = cb || noop;
		this.command(['cycle', 'audio'], cb);
	},

	cycleSubs: function(cb)
	{
		cb = cb || noop;
		this.command(['cycle', 'sub'], cb);
	},

	setFullscreen: function(isEnabled, cb)
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

		this.command(['set_property', 'fullscreen', isEnabled], cb);
	},

	cycleFullscreen: function(cb)
	{
		cb = cb || noop;
		this.command(['cycle', 'fullscreen'], cb);
	},

	keepOpen: function(value, cb)
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

		this.command(['set_property', 'keep-open', value], cb);
	},

	_playerQuit: function(cb)
	{
		cb = cb || noop;
		this.command(['quit', 0], cb);
	},

	_parseSocketData: function(data)
	{
		const splitOper = data.includes('\r\n') ? '\r\n' : '\n';
		const msgArray = data.split(splitOper);

		for(var i = 0; i < msgArray.length - 1; i++)
		{
			var msg = JSON.parse(msgArray[i]);
			if(msg.event === 'property-change')
			{
				var value = null;

				switch(msg.name)
				{
					case 'volume':
						value = msg.data / 100;
						break;
					case 'time-pos':
						if(
							!isNaN(prevPosition)
							&& Math.abs(prevPosition - msg.data) < 1
						) {
							continue;
						}
						value = Math.floor(msg.data);
						prevPosition = msg.data;
						break;
					case 'duration':
					case 'pause':
					case 'eof-reached':
						value = msg.data;
						break;
					default:
						break;
				}

				if(value !== null)
					this.emit('playback', { name: msg.name, value: value });
			}
		}
	}
}
