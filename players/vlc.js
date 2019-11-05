const noop = () => {};
var previous =
{
	position: -1,
	volume: -1
}

module.exports =
{
	init: function()
	{
		previous.position = -1;
		previous.volume = -1;

		this._setPlaybackInterval();
	},

	_setPlaybackInterval: function()
	{
		this.playbackInterval = setInterval(() => this.command(['get_time']), 250);
	},

	cleanup: function()
	{
		this._clearPlaybackInterval();
	},

	_clearPlaybackInterval: function()
	{
		clearInterval(this.playbackInterval);
	},

	getSpawnArgs: function(opts)
	{
		if(!Array.isArray(opts.args)) opts.args = [''];
		var presetArgs = ['-I', 'oldrc', '--rc-unix', opts.ipcPath,
			'--rc-fake-tty', opts.media];

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

		try { command = Object.values(params).join(' '); }
		catch(err) { return cb(err); }

		this.write(command + '\n', cb);
	},

	play: function(cb)
	{
		cb = cb || noop;
		this.command(['play'], cb);
	},

	pause: function(cb)
	{
		cb = cb || noop;
		this.command(['pause'], cb);
	},

	cyclePause: function(cb)
	{
		cb = cb || noop;
		this._clearPlaybackInterval();

		this.command(['is_playing'], (err) =>
		{
			if(!err)
			{
				this.once('data', (data) =>
				{
					this._setPlaybackInterval();

					const splitOper = audioData.includes('\r\n') ? '\r\n' : '\n';
					const dataArr = data.split(splitOper);
					const isPlaying = dataArr.some(el => el.charAt(0) === '1');

					if(isPlaying) this.pause(cb);
					else this.play(cb);
				});
			}
			else
			{
				this._setPlaybackInterval();
				return cb(err);
			}
		});
	},

	load: function(media, cb)
	{
		cb = cb || noop;
		this.command(['add', media], cb);
	},

	seek: function(position, cb)
	{
		cb = cb || noop;
		this.command(['seek', position], cb);
	},

	setVolume: function(value, cb)
	{
		cb = cb || noop;
		this.command(['volume', value], cb);
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
				isEnabled = 'on';
				break;
			default:
				isEnabled = 'off';
				break;
		}

		this.command(['repeat', isEnabled], cb);
	},

	cycleVideo: function(cb)
	{
		cb = cb || noop;
		this._actionFromOutData('Video Track', 'vtrack', cb);
	},

	cycleAudio: function(cb)
	{
		cb = cb || noop;
		this._actionFromOutData('Audio Track', 'atrack', cb);
	},

	cycleSubs: function(cb)
	{
		cb = cb || noop;
		this._actionFromOutData('Subtitle Track', 'strack', cb);
	},

	setFullscreen: function(isEnabled, cb)
	{
		cb = cb || noop;

		switch(isEnabled)
		{
			case false:
			case 'no':
			case 'off':
				isEnabled = 'off';
				break;
			default:
				isEnabled = 'on';
				break;
		}

		this.command(['fullscreen', isEnabled], cb);
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
		return cb(null);
	},

	_playerQuit: function(cb)
	{
		cb = cb || noop;
		this.command(['quit'], cb);
	},

	_parseSocketData: function(data)
	{
		const splitOper = data.includes('\r\n') ? '\r\n' : '\n';
		var msgArray = data.split(splitOper);
		msgArray.pop();

		msgArray.forEach(msg =>
		{
			if(!isNaN(msg))
			{
				var value = parseInt(msg, 10);
				if(value === previous.position) return;
				previous.position = value;

				this.emit('playback', { name: 'time-pos', value: value });
				return;
			}
			else if(msg.startsWith('status change:'))
			{
				var msgData = msg.substring(msg.indexOf('(') + 1, msg.indexOf(')')).split(':');
				if(msgData.length !== 2) return;

				var foundName = msgData[0].trim();
				var foundValue = msgData[1].trim();
				var eventName, eventValue;

				switch(foundName)
				{
					case 'play state':
						if(foundValue === '2')
						{
							eventName = 'pause';
							eventValue = false;
						}
						break;
					case 'pause state':
						if(foundValue === '3')
						{
							eventName = 'pause';
							eventValue = true;
						}
						break;
					case 'audio volume':
						eventName = 'volume';
						eventValue = parseFloat((foundValue / 256).toFixed(2));
						if(eventValue === previous.volume) return;
						previous.volume = eventValue;
						break;
					default:
						break;
				}

				if(eventName)
					this.emit('playback', { name: eventName, value: eventValue });
			}
		});
	},

	_actionFromOutData: function(searchString, action, cb)
	{
		cb = cb || noop;
		this._clearPlaybackInterval();

		var outData = '';
		var resolved = false;

		const onOutData = (data) =>
		{
			outData += data;
			if(outData.includes(`+----[ end of ${searchString} ]`))
			{
				resolved = true;
				this.removeListener('data', onOutData);
				this._setPlaybackInterval();

				parseTracksData(outData, searchString, (err, result) =>
				{
					if(err) return cb(err);

					var nextTrack = getNextTrackNumber(result);
					this.command([action, nextTrack], cb);
				});
			}
		}

		this.on('data', onOutData);
		var timeout = setTimeout(() => onDataError(new Error(`${searchString} data timeout`), 1000));

		const onDataError = (err) =>
		{
			if(!resolved)
			{
				clearTimeout(timeout);
				this.removeListener('data', onOutData);
				this._setPlaybackInterval();

				return cb(err);
			}
		}

		this.command([action], (err) =>
		{
			if(err) onDataError(err);
		});
	}
}

function parseTracksData(outData, searchString, cb)
{
	const splitOper = outData.includes('\r\n') ? '\r\n' : '\n';
	const dataArr = outData.split(splitOper);

	const infoStart = dataArr.indexOf(`+----[ ${searchString} ]`);
	const infoEnd = dataArr.indexOf(`+----[ end of ${searchString} ]`);

	if(infoStart < 0 || infoEnd < 0 || infoStart > infoEnd)
		return cb(new Error(`Could not find ${searchString.toLowerCase()} data`));

	var tracksArr = dataArr.slice(infoStart + 1, infoEnd);

	if(tracksArr.length < 1)
		return cb(new Error(`Could not obtain ${searchString.toLowerCase()} list`));

	const currTrack = tracksArr.find(el => el.endsWith('*'));

	if(!currTrack)
		return cb(new Error(`Could not determine active ${searchString.toLowerCase()}`));

	const activeNumber = tracksArr.indexOf(currTrack);

	for(var i in tracksArr)
	{
		tracksArr[i] = tracksArr[i].substring(2, tracksArr[i].indexOf(' - '));

		if(isNaN(tracksArr[i]))
			return cb(new Error(`Could not parse ${searchString.toLowerCase()} numbers`));
	}

	return cb(null, {tracksArr, activeNumber});
}

function getNextTrackNumber(tracksData)
{
	var isLastTrack = (tracksData.tracksArr.length - 1 === tracksData.activeNumber);
	return (isLastTrack) ? tracksData.tracksArr[0] : tracksData.tracksArr[tracksData.activeNumber + 1];
}
