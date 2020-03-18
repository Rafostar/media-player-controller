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

/* Prevent emiting 'eof-reached' at launch */
var launched = false;
var streams;

module.exports =
{
	init: function()
	{
		previous = {};
		streams = {};
		launched = false;

		this._intervalEnabled = true;
		this._getPlayerData();
	},

	_connectType: 'web',
	_forceEnglish: true,

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

				var isPlaying = (result.state === 'playing');
				time = this._getProbeTime(isPlaying, result.time);
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
					value = (launched && value === 'stopped');
					break;
				case 'time-pos':
				case 'duration':
					value = parseInt(value);
					if(value < 0)
						continue;
					else if(!launched && value > 0)
						launched = true;
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

		if(
			!result.information
			|| !result.information.category
			|| !result.information.category.length
			|| streams.count === result.information.category.length
		)
			return;

		streams = {
			count: result.information.category.length,
			video: [],
			audio: [],
			subs: []
		};

		result.information.category.forEach(cat =>
		{
			if(!cat['$'].name.startsWith('Stream')) return;

			var index = cat['$'].name.split(' ')[1];
			var streamType = cat.info.find(inf => inf['$'].name === 'Type');

			switch(streamType._)
			{
				case 'Video':
					streams.video.push(index);
					break;
				case 'Audio':
					streams.audio.push(index);
					break;
				case 'Subtitle':
					streams.subs.push(index);
					break;
				default:
					break;
			}
		});
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
			'--no-qt-recentplay',
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
		previous.duration = null;

		var delId = previous.id;
		this.command(['in_play', `input=${media}`], (err) =>
		{
			if(err) return cb(err);

			streams = {};
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

		if(!streams.video.length)
			return cb(new Error('No video tracks'));

		this.command(['video_track', `val=${streams.video[0]}`], cb);
	},

	cycleAudio: function(cb)
	{
		cb = cb || noop;

		if(!streams.audio.length)
			return cb(new Error('No audio tracks'));

		this.command(['audio_track', `val=${streams.audio[0]}`], cb);
	},

	cycleSubs: function(cb)
	{
		cb = cb || noop;

		if(!streams.subs.length)
			return cb(new Error('No subtitles tracks'));

		this.command(['subtitle_track', `val=${streams.subs[0]}`], cb);
	},

	addSubs: function(subsPath, cb)
	{
		cb = cb || noop;

		if(!subsPath)
			return cb(new Error('No subtitles path specified'));

		this.command(['addsubtitle', `val=${subsPath}`], (err) =>
		{
			if(err) return cb(err);

			if(!streams.subs.length)
				return cb(new Error('No subtitles tracks'));

			var lastSubs = Math.max.apply(null, streams.subs);

			/* Give VLC some time to load file */
			setTimeout(() => {
				this.command(['subtitle_track', `val=${lastSubs}`], cb);
			}, 100);
		});
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
