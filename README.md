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

var player = new PlayerController({ app: 'mpv' });

/* Path to file or link. Can be changed anytime without creating new player objects */
player.opts.media = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

player.launch(err =>
{
  if(err) {
    console.error(err.message);
  }
});

player.on('playback', console.log);
```

Each playback controlling function have an optional callback with eventual `error`.<br>
They are executed asynchronously by default.

Currrently `mpv` and `vlc` media players are supported.

### List of available functions
```javascript
.launch()                    // Launch media player
.quit()                      // Stop media player process

.play()                      // Resume playback
.pause()                     // Pause playback
.cyclePause()                // Cycle play/pause
.load(mediaPath)             // Load new media file (without closing player)
.seek(position)              // Seek to position (value in seconds)
.setVolume(value)            // Adjust player volume (value 0-100)
.setRepeat(isEnabled)        // Repeat playback (true or false)
.cycleVideo()                // Switch active video track
.cycleAudio()                // Switch active audio track
.cycleSubs()                 // Switch active subtitle track
.setFullscreen(isEnabled)    // Enable or disable fullscreen (true or false)
.cycleFullscreen()           // Toggle fullscreen on/off
.keepOpen(isEnabled)         // Keep player open after playback (true or false)

.command([args])             // Custom command for IPC socket (array of args)
```

### List of available events
```javascript
.on('app-launch')            // Emited on media player app launch
.on('playback', data)        // Data object with current playback event
.on('app-exit', code)        // Exit code emited on media player app close
```

## Donation
If you like my work please support it by buying me a cup of coffee :-)

[![PayPal](https://github.com/Rafostar/gnome-shell-extension-cast-to-tv/wiki/images/paypal.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
