const noop = () => {};
const helper = require('../helper');

var previous;
var httpOpts = { xml: true };
var playerData =
{
	'time-pos': 'time',
	'volume': 'volume',
	'duration': 'length',
	'pause': 'state',
	'eof-reached': 'state'
};

module.exports =
{
	init: function()
	{
		previous = {};

		this._intervalEnabled = true;
		this._getPlayerData();
	},

	_connectType: 'web',

	_getPlayerData: function()
	{
		const onTimeout = () =>
		{
			this._getDataTimeout = null;
			this._getPlayerData();
		}

		httpOpts.path = '/requests/status.xml';
		helper.httpRequest(httpOpts, (err, result) =>
		{
			var time = 1000;

			if(!err && this._intervalEnabled)
			{
				this._parseRequest(result);
				time = 500;
			}

			if(this._intervalEnabled)
				this._getDataTimeout = setTimeout(() => onTimeout(), time);
		});
	},

	_parseRequest: function(result)
	{
		for(var key in playerData)
		{
			var value = result[playerData[key]];

			switch(key)
			{
				case 'pause':
					value = (value === 'paused');
					break;
				case 'eof-reached':
					value = (value === 'stopped');
					break;
				case 'time-pos':
				case 'duration':
					value = parseInt(value);
					if(value < 0)
						continue;
					break;
				case 'volume':
					value = Math.round(value / 2.56) / 100;
					if(value < 0)
						continue;
					break;
				default:
					if(value == 'true')
						value = true;
					else if(value == 'false')
						value = false;
					break;
			}

			if(
				previous.hasOwnProperty(key)
				&& previous[key] === value
			)
				continue;

			previous[key] = value;
			this.emit('playback', { name: key, value: value });
		}

		previous.repeat = (result.repeat === true || result.repeat === 'true');
		previous.fullscreen = (result.fullscreen > 0);

		if(result.currentplid > 0)
			previous.id = result.currentplid;
	},

	cleanup: function()
	{
		this._intervalEnabled = false;

		if(this._getDataTimeout)
			clearTimeout(this._getDataTimeout);
	},

	_getSpawnArgs: function(opts)
	{
		/* VLC requires password for web interface */
		httpOpts.pass = opts.httpPass || 'vlc';
		httpOpts.port = opts.httpPort;

		var presetArgs = [
			'--no-play-and-exit',
			'--qt-continue', '0',
			'--image-duration', '-1',
			'--extraintf', 'http',
			'--http-port', httpOpts.port,
			'--http-password', httpOpts.pass,
			opts.media
		];

		return [ ...opts.args, ...presetArgs ];
	},

	command: function(params, cb)
	{
		cb = cb || noop;
		var command = null;

		if(!Array.isArray(params))
			return cb(new Error('No command parameters array!'));

		for(var cmd of params)
		{
			if(!command)
				command = cmd;
			else
				command += `&${cmd}`;
		}

		httpOpts.path = '/requests/status.xml?command=' + command;
		helper.httpRequest(httpOpts, (err, result) =>
		{
			if(err) return cb(err);

			httpOpts.path = '/requests/status.xml';
			helper.httpRequest(httpOpts, (err, result) =>
			{
				if(err) return cb(err);

				this._parseRequest(result);
				cb(null);
			});
		});
	},

	play: function(cb)
	{
		cb = cb || noop;

		if(previous.pause)
			this.cyclePause(cb);
		else
			cb(null);
	},

	pause: function(cb)
	{
		cb = cb || noop;

		if(!previous.pause)
			this.cyclePause(cb);
		else
			cb(null);
	},

	cyclePause: function(cb)
	{
		cb = cb || noop;
		this.command(['pl_pause'], cb);
	},

	_load: function(media, cb)
	{
		cb = cb || noop;
		var delId = previous.id;
		this.command(['in_play', `input=${media}`], (err) =>
		{
			if(err) return cb(err);

			this.command(['pl_delete', `id=${delId}`], cb);
		});
	},

	seek: function(position, cb)
	{
		cb = cb || noop;
		position = (position > 0) ? parseInt(position) : 0;

		this.command(['seek', `val=${position}`], cb);
	},

	setVolume: function(value, cb)
	{
		cb = cb || noop;
		value = (value > 0) ? parseInt(value * 256) : 0;

		this.command(['volume', `val=${value}`], cb);
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
				isEnabled = true;
				break;
			default:
				isEnabled = false;
				break;
		}

		if(
			isEnabled && previous.repeat
			|| !isEnabled && !previous.repeat
		)
			return cb(null);

		this.command(['pl_repeat'], cb);
	},

	cycleVideo: function(cb)
	{
		cb = cb || noop;
		this.command(['video_track', `val=1`], cb);
	},

	cycleAudio: function(cb)
	{
		cb = cb || noop;
		this.command(['audio_track', `val=1`], cb);
	},

	cycleSubs: function(cb)
	{
		cb = cb || noop;
		this.command(['subtitle_track', `val=1`], cb);
	},

	setFullscreen: function(isEnabled, cb)
	{
		cb = cb || noop;

		switch(isEnabled)
		{
			case false:
			case 'no':
			case 'off':
				isEnabled = false;
				break;
			default:
				isEnabled = true;
				break;
		}

		if(
			isEnabled && previous.fullscreen
			|| !isEnabled && !previous.fullscreen
		)
			return cb(null);

		this.command(['fullscreen'], cb);
	},

	cycleFullscreen: function(cb)
	{
		cb = cb || noop;
		this.command(['fullscreen'], cb);
	},

	keepOpen: function(value, cb)
	{
		cb = cb || noop;

		/* VLC always uses keep open */
		cb(new Error('VLC does not support keep open command'));
	},

	_playerQuit: function(cb)
	{
		cb = cb || noop;

		this.cleanup();
		cb(new Error('VLC does not support remote quit command'));
	}
}
