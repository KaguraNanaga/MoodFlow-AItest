/**
 * Audio Player Module - Manages audio playback and seamless transitions.
 */

// Player state management
const playerState = {
    currentMood: null, // The mood currently being played
    isPlaying: false, // Is audio currently playing?
    audioQueue: [], // Stores the URL of the *next* pre-fetched song
    currentAudioUrl: null, // URL of the audio currently loaded/playing
    advanceRequestTime: 30, // How many seconds before the end to request the next song (adjust based on API speed)
    isRequestingNextSong: false // Flag to prevent concurrent requests for the next song
};

// DOM element references
let audioElement;
let progressElement;
// let statusMessageElement; // Will use window.updateStatusMessage from app.js
let currentMoodTextElement;
let playPauseButton;
let playIcon;
let pauseIcon;
let loadingIndicator; // Reference to the loading indicator

/**
 * Initialize the audio player elements and event listeners.
 */
function initAudioPlayer() {
    // Get DOM elements
    audioElement = document.getElementById('audio-player');
    progressElement = document.getElementById('progress');
    // statusMessageElement = document.getElementById('status-message'); // Use global updateStatusMessage
    currentMoodTextElement = document.getElementById('current-mood-text');
    playPauseButton = document.getElementById('play-pause-btn');
    playIcon = document.getElementById('play-icon');
    pauseIcon = document.getElementById('pause-icon');
    loadingIndicator = document.getElementById('loading-indicator'); // Get loading indicator

    // Validate that all essential elements were found
    if (!audioElement || !progressElement || !currentMoodTextElement || !playPauseButton || !playIcon || !pauseIcon || !loadingIndicator) {
        console.error("One or more audio player UI elements are missing in the HTML.");
        // Optionally disable player functionality or show a critical error
        if (typeof window.updateStatusMessage === 'function') {
            window.updateStatusMessage("错误：播放器界面元素缺失。", true); // Error: Player UI elements missing.
        }
        return; // Stop initialization if elements are missing
    }

    // Setup essential event listeners for the audio element
    audioElement.addEventListener('timeupdate', handleTimeUpdate); // Handles progress bar and pre-fetching next song
    audioElement.addEventListener('ended', playNextInQueue); // Handles transition when a song finishes naturally
    audioElement.addEventListener('error', handleAudioError); // Handles playback errors
    audioElement.addEventListener('loadstart', () => updateStatusMessage('正在加载音频...')); // Loading audio...
    audioElement.addEventListener('canplay', () => updateStatusMessage('准备播放')); // Ready to play
    audioElement.addEventListener('waiting', () => updateStatusMessage('缓冲中...')); // Buffering...
    audioElement.addEventListener('playing', () => { // When playback actually starts/resumes
         updateStatusMessage('正在播放'); // Playing
         playerState.isPlaying = true;
         updatePlayPauseButton();
         hideLoading(); // Hide loading indicator when playing starts
    });
     audioElement.addEventListener('pause', () => { // When playback pauses (user-initiated or otherwise)
         // Only update status if it wasn't an intentional stop (e.g., changing mood)
         if (playerState.currentMood) {
             updateStatusMessage('已暂停'); // Paused
         }
         playerState.isPlaying = false;
         updatePlayPauseButton();
     });


    // Setup play/pause button listener
    playPauseButton.addEventListener('click', togglePlayPause);

    // Setup Media Session API if available for OS-level controls
    if ('mediaSession' in navigator) {
        setupMediaSession();
    }
    console.log("Audio Player Initialized.");
}

/**
 * Start playing music for the selected mood.
 * Fetches the first song and then relies on timeupdate to fetch subsequent songs.
 * @param {string} mood - The mood identifier (e.g., 'calm-focus').
 */
async function startMusicByMood(mood) {
    console.log(`Starting music for mood: ${mood}`);
    // Reset state for the new mood
    resetPlayerState(mood);
    showLoading('正在生成第一首歌曲...'); // Generating first song...

    // Check prerequisites
    if (!window.MoodFlowAPI || !window.MoodFlowAPI.isApiTokenSet()) {
        hideLoading();
        // showError function from app.js should handle showing the API key modal
        if (typeof window.showError === 'function') {
            window.showError('请先设置API密钥'); // Please set API key first
        } else {
             console.error("showError function not found.");
        }
        return;
    }
     if (window.location.protocol === 'file:') {
         console.warn('Running from file://, API requests might fail due to CORS.');
         // No need to show error here as app.js already warns about file://
     }

    // Update UI for the player
    showPlayerInterface();
    const moodName = window.MoodFlowAPI.MOOD_NAMES?.[mood] || mood; // Get display name or use key
    if (currentMoodTextElement) currentMoodTextElement.textContent = moodName;


    try {
        // Generate the *first* song only
        const audioUrl = await window.MoodFlowAPI.generateMusic(mood);

        if (!audioUrl || typeof audioUrl !== 'string') {
            throw new Error('未能获取有效的音乐URL'); // Failed to get a valid music URL
        }

        console.log(`First song generated: ${audioUrl}`);
        playAudio(audioUrl); // Start playing the first song

        // **REMOVED:** requestNextSong(); // Do NOT request next song immediately. Let timeupdate handle it.

    } catch (error) {
        hideLoading();
        console.error(`音乐生成失败 (Music generation failed) for mood ${mood}:`, error);
        // Use showError from app.js for consistent error handling
        if (typeof window.showError === 'function') {
            // Pass the detailed error message
            window.showError(error.message || '生成音乐时发生未知错误'); // Unknown error during music generation
        } else {
             alert(`音乐生成失败: ${error.message}`); // Fallback alert
        }
        // **IMPROVED:** Immediately allow user to select another mood instead of using setTimeout
        showMoodSelection(); // Go back to mood selection on failure
    }
}

/**
 * Load and play the audio from the given URL.
 * @param {string} audioUrl - The URL of the audio file to play.
 */
function playAudio(audioUrl) {
    console.log(`Playing audio: ${audioUrl}`);
    playerState.currentAudioUrl = audioUrl;
    audioElement.src = audioUrl;
    audioElement.load(); // Load the new source

    // Attempt to play
    const playPromise = audioElement.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            // Playback started successfully
            playerState.isPlaying = true;
            updatePlayPauseButton();
            // Status updated by 'playing' event listener
            // Update Media Session metadata
             if ('mediaSession' in navigator) {
                 const moodName = window.MoodFlowAPI.MOOD_NAMES?.[playerState.currentMood] || playerState.currentMood;
                 navigator.mediaSession.metadata = new MediaMetadata({
                     title: `MoodFlow AI: ${moodName}`,
                     artist: 'AI Generated',
                     // album: 'MoodFlow Session', // Optional
                     // artwork: [...] // Optional artwork
                 });
             }
        }).catch(error => {
            // Autoplay often fails if user hasn't interacted with the page first
            console.error('音频播放失败 (Audio playback failed):', error);
            updateStatusMessage(`播放错误: ${error.message}. 请尝试手动点击播放。`, true); // Playback error... Try clicking play.
            playerState.isPlaying = false; // Ensure state is correct
            updatePlayPauseButton(); // Show play button
            hideLoading();
        });
    } else {
         // Fallback for browsers that don't return a promise (older)
         // We rely on the 'playing' event listener to confirm playback
         console.log("audioElement.play() did not return a promise.");
    }
}

/**
 * Request the next song from the API *if* not already requesting.
 */
async function requestNextSong() {
    // Prevent request if no mood is active or if already requesting
    if (!playerState.currentMood || playerState.isRequestingNextSong) {
        // console.log("Skipping requestNextSong: No mood or already requesting.");
        return;
    }

    // Set flag to prevent concurrent requests
    playerState.isRequestingNextSong = true;
    console.log("Requesting next song...");
    updateStatusMessage('正在准备下一首歌曲...'); // Preparing next song...
    showLoading('正在生成下一首歌曲...'); // Show loading indicator specifically for next song generation

    try {
        const nextAudioUrl = await window.MoodFlowAPI.generateMusic(playerState.currentMood);

        if (!nextAudioUrl || typeof nextAudioUrl !== 'string') {
             throw new Error('未能获取有效的下一首歌曲URL'); // Failed to get valid next song URL
        }

        // Add the fetched URL to the queue
        playerState.audioQueue.push(nextAudioUrl);
        console.log(`Next song added to queue: ${nextAudioUrl}`);
        updateStatusMessage('下一首歌曲已准备好'); // Next song ready

    } catch (error) {
        console.error('生成下一首歌曲失败 (Failed to generate next song):', error);
        updateStatusMessage('获取下一首歌失败，将在当前歌曲结束后重试。', true); // Failed to get next song, will retry after current song.
        // Don't immediately retry here, let 'ended' or error handling trigger retry
    } finally {
        // Reset the flag whether request succeeded or failed
        playerState.isRequestingNextSong = false;
        hideLoading(); // Hide indicator once request is done
        console.log("Finished requestNextSong attempt.");
    }
}

/**
 * Called when the current audio track ends. Plays the next song from the queue or retries generation.
 */
function playNextInQueue() {
    console.log("Current song ended.");
    if (playerState.audioQueue.length > 0) {
        // Play the next song from the queue
        const nextAudioUrl = playerState.audioQueue.shift(); // Get and remove the first item
        console.log("Playing next song from queue.");
        playAudio(nextAudioUrl);
        // **REMOVED:** requestNextSong(); // Let timeupdate handle the *next* request
    } else {
        // Queue is empty (prefetch might have failed or is still running)
        console.warn("Queue is empty when song ended. Attempting to generate a new song.");
        updateStatusMessage('队列为空，正在尝试生成新歌曲...'); // Queue empty, trying to generate new song...
        // Attempt to generate a new song immediately for the current mood
        // This handles cases where the pre-fetch failed
        if (playerState.currentMood) {
            startMusicByMood(playerState.currentMood);
        } else {
             console.error("Cannot play next: No current mood set.");
             showMoodSelection(); // Go back if state is inconsistent
        }
    }
}

/**
 * Toggle the playback state between play and pause.
 */
function togglePlayPause() {
    if (!playerState.currentAudioUrl) {
         console.log("Play/Pause clicked, but no audio loaded.");
         return; // Do nothing if no audio is loaded
    }

    if (playerState.isPlaying) {
        audioElement.pause();
        // State and button update handled by 'pause' event listener
    } else {
        // Attempt to play
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('恢复播放失败 (Resume playback failed):', error);
                 updateStatusMessage(`恢复播放失败: ${error.message}`, true); // Resume playback failed
                playerState.isPlaying = false; // Ensure state is correct
                updatePlayPauseButton(); // Show play button
            });
        }
        // State and button update handled by 'playing' event listener
    }
}

/**
 * Update the visual state of the play/pause button.
 */
function updatePlayPauseButton() {
    if (playerState.isPlaying) {
        playIcon?.classList.add('hidden');
        pauseIcon?.classList.remove('hidden');
    } else {
        playIcon?.classList.remove('hidden');
        pauseIcon?.classList.add('hidden');
    }
}

/**
 * Handle the 'timeupdate' event from the audio element.
 * Updates the progress bar and triggers fetching the next song.
 */
function handleTimeUpdate() {
    if (audioElement.duration && isFinite(audioElement.duration)) {
        // Update progress bar
        const progress = (audioElement.currentTime / audioElement.duration) * 100;
        if (progressElement) {
            progressElement.style.width = `${progress}%`;
        }

        // Check if it's time to request the next song
        const timeRemaining = audioElement.duration - audioElement.currentTime;
        // **IMPROVED LOGIC:** Only request if time is low, queue is empty, AND not already requesting
        if (timeRemaining <= playerState.advanceRequestTime && playerState.audioQueue.length === 0 && !playerState.isRequestingNextSong) {
            console.log(`Time remaining (${timeRemaining.toFixed(1)}s) <= advance time (${playerState.advanceRequestTime}s). Requesting next song.`);
            requestNextSong();
        }
    } else {
         // Handle cases where duration is not available (e.g., streaming issues)
         if (progressElement) {
             progressElement.style.width = '0%';
         }
    }
}


/**
 * Handle errors during audio playback.
 * @param {Event} event - The error event object.
 */
function handleAudioError(event) {
    console.error('音频播放错误 (Audio playback error):', event, audioElement.error);
    let errorMsg = '播放时发生未知错误。'; // Unknown error during playback.
    if (audioElement.error) {
         switch (audioElement.error.code) {
             case MediaError.MEDIA_ERR_ABORTED:
                 errorMsg = '音频播放已中止。'; // Playback aborted.
                 break;
             case MediaError.MEDIA_ERR_NETWORK:
                 errorMsg = '网络错误导致音频下载失败。'; // Network error caused download failure.
                 break;
             case MediaError.MEDIA_ERR_DECODE:
                 errorMsg = '音频解码错误。文件可能已损坏或格式不支持。'; // Decode error. File might be corrupt/unsupported.
                 break;
             case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                 errorMsg = '音频源格式不支持。'; // Audio source format not supported.
                 break;
             default:
                 errorMsg = `发生未知播放错误 (Code: ${audioElement.error.code})。`; // Unknown playback error.
         }
    }
    updateStatusMessage(errorMsg, true);
    hideLoading(); // Ensure loading indicator is hidden on error

    // Attempt recovery: Try playing the next song in the queue
    if (playerState.audioQueue.length > 0) {
        console.log("Audio error occurred, trying next song from queue.");
        playNextInQueue();
    } else {
        // If queue is empty, attempt to regenerate (could lead to loop if generation always fails)
        console.warn("Audio error occurred and queue is empty. Attempting to regenerate music for current mood.");
        // Add a small delay before retrying to avoid instant loops if generation fails quickly
        setTimeout(() => {
            if (playerState.currentMood) {
                 startMusicByMood(playerState.currentMood);
            } else {
                 showMoodSelection(); // Go back if no mood is set
            }
        }, 2000); // 2-second delay before retry
    }
}

/**
 * Show the player UI and hide the mood selection.
 */
function showPlayerInterface() {
    document.getElementById('mood-selection')?.classList.add('hidden');
    document.getElementById('player-container')?.classList.remove('hidden');
}

/**
 * Show the mood selection UI and hide the player, stopping playback.
 */
function showMoodSelection() {
    document.getElementById('mood-selection')?.classList.remove('hidden');
    document.getElementById('player-container')?.classList.add('hidden');

    // Stop playback and reset state
    resetPlayerState(null); // Pass null to clear mood
    if (audioElement) {
        audioElement.pause();
        audioElement.src = ""; // Clear source
    }
     if (progressElement) {
         progressElement.style.width = '0%'; // Reset progress bar
     }
     // Reset time display handled by 'emptied' event in setupTimeDisplay
    console.log("Returned to mood selection.");
}

/**
 * Reset player state, optionally setting a new mood.
 * @param {string | null} newMood - The new mood to set, or null to clear.
 */
function resetPlayerState(newMood) {
     playerState.currentMood = newMood;
     playerState.isPlaying = false;
     playerState.audioQueue = [];
     playerState.currentAudioUrl = null;
     playerState.isRequestingNextSong = false; // Ensure request flag is reset
     updatePlayPauseButton(); // Update button to show 'play' icon
     hideLoading(); // Ensure loading indicator is hidden
     // Don't reset status message here, let calling function set appropriate message
}


/**
 * Show the loading indicator with a specific message.
 * @param {string} message - Message to display while loading.
 */
function showLoading(message = '加载中...') { // Loading...
    if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
    }
    updateStatusMessage(message); // Update main status as well
}

/**
 * Hide the loading indicator.
 */
function hideLoading() {
    if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
    }
}


/**
 * Setup Media Session handlers for OS-level media controls.
 */
function setupMediaSession() {
    const actionHandlers = [
      ['play', () => togglePlayPause()], // Use togglePlayPause for consistency
      ['pause', () => togglePlayPause()],
      // 'stop', // Stop is often handled by pause
      ['nexttrack', () => playNextInQueue()],
      // 'previoustrack', // Not implemented in this version
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.warn(`The media session action "${action}" is not supported.`);
      }
    }
    console.log("Media Session handlers set up.");
}

// --- Helper: Update Status Message ---
// Wrapper to ensure the global function from app.js is used if available
function updateStatusMessage(message, isError = false) {
    if (typeof window.updateStatusMessage === 'function') {
        window.updateStatusMessage(message, isError);
    } else {
        // Fallback if the global function isn't loaded yet or is missing
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.textContent = message;
            // Basic error styling fallback
            statusElement.style.color = isError ? 'red' : 'inherit';
        }
        console.log(`Status (fallback): ${message}${isError ? ' (ERROR)' : ''}`);
    }
}


// --- Expose Public Methods ---
// Make the necessary functions available globally under MoodFlowPlayer
window.MoodFlowPlayer = {
    init: initAudioPlayer,
    startMusicByMood: startMusicByMood,
    showMoodSelection: showMoodSelection,
    // Expose togglePlayPause if needed externally, otherwise internal is fine
    // togglePlayPause: togglePlayPause
};
