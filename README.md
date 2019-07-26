# media-player-controller
[![License](https://img.shields.io/github/license/Rafostar/media-player-controller.svg)](https://github.com/Rafostar/media-player-controller/blob/master/LICENSE)
[![npm](https://img.shields.io/npm/v/media-player-controller.svg)](https://www.npmjs.com/package/media-player-controller)
[![Downloads](https://img.shields.io/npm/dt/media-player-controller.svg)](https://www.npmjs.com/package/media-player-controller)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
[![Donate](https://img.shields.io/badge/Donate-PayPal.Me-lightgrey.svg)](https://www.paypal.me/Rafostar)

Spawn media player app and control playback. Also allows reading player state through socket connection.

### Usage Example
```javascript
const PlayerController = require('media-player-controller');

var controller = new PlayerController({
	player: 'mpv', playerArgs: ['--fullscreen=no'], ipcPath: '/tmp/media-controller-socket'
});

/* Path to file or link */
controller.opts.media = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

controller.launch((err) =>
{
	if(err) return console.error(err.message);
	readSocketData();
});

function readSocketData()
{
	controller.process.stdout.once('data', () =>
	{
		if(controller.player.socket)
			controller.player.socket.on('data', logStatus);
	});

	controller.process.stdout.once('close', () => console.log('\nPlayer closed'));
	controller.process.on('error', (err) => console.error(err.message));
}

function logStatus(message)
{
	/* More than one event can occur at once (so we split them to array) */
	const msgArray = message.split('\n');
	var dataArray = [];

	msgArray.forEach(msg =>
	{
		if(msg.length && msg.includes('event'))
			dataArray.push(msg);
	});

	if(!dataArray.length) return;

	process.stdout.cursorTo(0);
	process.stdout.clearLine(0);
	process.stdout.write(JSON.stringify(dataArray).replace(/\\|"/g, ''));
}
```

Each controller function has an optional callback that returns an `error` or `null` on success.<br>
They are executed asynchronously by default.

Currrently only `mpv` media player is supported!

### List of available functions
```javascript
controller.launch()                          // Launch media player
controller.quit()                            // Stop media player process

controller.player.play()                     // Resume playback
controller.player.pause()                    // Pause playback
controller.player.cyclePause()               // Cycle play/pause
controller.player.load(mediaPath)            // Load new media file (without closing player)
controller.player.seek(position)             // Seek to position (value in seconds)
controller.player.setVolume(value)           // Adjust player volume (value 0-100)
controller.player.setRepeat(isEnabled)       // Repeat playback (true or false)
controller.player.cycleVideo()               // Switch active video track
controller.player.cycleAudio()               // Switch active audio track
controller.player.cycleSubs()                // Switch active subtitle track
controller.player.setFullscreen(isEnabled)   // Enable or disable fullscreen (true or false)
controller.player.cycleFullscreen()          // Toggle fullscreen on/off
controller.player.keepOpen(isEnabled)        // Keep player open after playback (true or false)

controller.player.command([args])            // Custom command for IPC socket (array of args)
```

## Donation
If you like my work please support it by buying me a cup of coffee :-)

[![PayPal](https://github.com/Rafostar/gnome-shell-extension-cast-to-tv/wiki/images/paypal.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
