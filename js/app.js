/**
 * MoodFlow AI - Main Application Logic
 */

// Store the mood that triggered the API key modal
let pendingMood = null;

// When the document is fully loaded, initialize the application
document.addEventListener('DOMContentLoaded', initApp);

/**
 * Initialize the application: setup listeners, load API key, check environment.
 */
function initApp() {
    // Initialize the audio player module (assuming it exists in audio-player.js)
    if (window.MoodFlowPlayer && typeof window.MoodFlowPlayer.init === 'function') {
        window.MoodFlowPlayer.init();
    } else {
        console.error("MoodFlowPlayer or MoodFlowPlayer.init is not defined. Check audio-player.js.");
        // Display an error to the user if the player can't initialize
        updateStatusMessage("错误：无法初始化播放器。", true);
        // Optionally disable relevant UI elements if the player is essential
    }

    // Update the copyright year in the footer
    const currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    // Check the runtime environment (e.g., file:// protocol)
    checkEnvironment();

    // Attempt to load a saved API key from localStorage
    if (window.MoodFlowAPI && typeof window.MoodFlowAPI.loadApiToken === 'function' && window.MoodFlowAPI.loadApiToken()) {
        console.log('已加载保存的API密钥 (Loaded saved API key)');
    } else {
        // If no key is loaded, show the modal to prompt the user
        showApiKeyModal();
    }

    // Setup event listeners for UI elements
    setupMoodCards();
    setupPlayerControls();
    setupApiKeyModal();
    setupAudioPreview(); // Sets up hover previews
    setupTimeDisplay(); // Updates the time display for the audio player

    console.log("MoodFlow AI App Initialized.");
}

/**
 * Check the runtime environment and display warnings if necessary.
 */
function checkEnvironment() {
    // Warn if running directly from the file system
    if (window.location.protocol === 'file:') {
        console.warn('应用正在以本地文件形式运行 (Application is running from file:// protocol), API functionality may be limited. It is recommended to use an HTTP server.');

        // Display a warning message at the top of the page
        const warningDiv = document.createElement('div');
        // Use Tailwind classes for styling if available, otherwise fallback to inline styles or a dedicated CSS class
        warningDiv.className = 'environment-warning bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4 text-center sticky top-0 z-50'; // Example Tailwind classes
        warningDiv.innerHTML = `
            <p class="font-bold">⚠️ 运行环境提示 (Environment Warning)</p>
            <p class="text-sm">您似乎正在直接打开HTML文件。为了保证所有功能正常（特别是API调用），请使用本地HTTP服务器运行。</p>
            <p class="text-xs mt-1">例如，在项目目录下运行: <code>python -m http.server 8000</code> 然后访问 <code>http://localhost:8000</code></p>
            <button id="close-warning" class="absolute top-0 bottom-0 right-0 px-4 py-3 text-yellow-700 hover:text-yellow-900">&times;</button>
        `;
        document.body.insertBefore(warningDiv, document.body.firstChild);

        // Add close button functionality
        const closeButton = document.getElementById('close-warning');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                warningDiv.style.display = 'none';
            });
        }
        // Note: Consider adding the styles for '.environment-warning code' etc. to your main CSS file instead of injecting them here.
    }

    // Check initial network status
    if (!navigator.onLine) {
        console.warn('设备当前离线 (Device is currently offline). API functionality will be unavailable.');
        showError('您的设备当前处于离线状态，请连接网络。'); // Your device is offline, please connect to the network.
    }

    // Listen for network status changes
    window.addEventListener('online', () => {
        console.log('网络已连接 (Network connected)');
        updateStatusMessage('网络已连接。', false); // Network connected.
    });

    window.addEventListener('offline', () => {
        console.warn('网络已断开 (Network disconnected)');
        showError('网络连接已断开，API功能将无法工作。'); // Network disconnected, API features will not work.
        // Optionally stop any ongoing API requests or playback
        if (window.MoodFlowPlayer && typeof window.MoodFlowPlayer.stop === 'function') {
            window.MoodFlowPlayer.stop(); // Assuming a stop function exists
        }
    });
}

/**
 * Add click event listeners to the mood selection cards.
 */
function setupMoodCards() {
    const moodCards = document.querySelectorAll('.mood-card');
    moodCards.forEach(card => {
        card.addEventListener('click', () => {
            const mood = card.getAttribute('data-mood');
            if (!mood) {
                console.error("Mood card is missing data-mood attribute:", card);
                return;
            }

            console.log(`Mood card clicked: ${mood}`);

            // Check if API key is set before starting music
            if (window.MoodFlowAPI && typeof window.MoodFlowAPI.isApiTokenSet === 'function' && window.MoodFlowAPI.isApiTokenSet()) {
                // If key is set, start the music directly
                if (window.MoodFlowPlayer && typeof window.MoodFlowPlayer.startMusicByMood === 'function') {
                    window.MoodFlowPlayer.startMusicByMood(mood);
                } else {
                     console.error("MoodFlowPlayer.startMusicByMood is not defined.");
                     updateStatusMessage("错误：无法启动音乐。", true); // Error: Cannot start music.
                }
            } else {
                // If key is not set, store the selected mood and show the API key modal
                console.log("API key not set, showing modal.");
                pendingMood = mood; // Store the mood that was clicked
                showApiKeyModal();
            }
        });
    });
}

/**
 * Add click listeners for player controls (Change Mood).
 */
function setupPlayerControls() {
     const changeMoodBtn = document.getElementById('change-mood-btn');
     if (changeMoodBtn) {
         changeMoodBtn.addEventListener('click', () => {
             if (window.MoodFlowPlayer && typeof window.MoodFlowPlayer.showMoodSelection === 'function') {
                 window.MoodFlowPlayer.showMoodSelection();
             } else {
                 console.error("MoodFlowPlayer.showMoodSelection is not defined.");
                 // Fallback: Manually hide player and show mood selection if function is missing
                 document.getElementById('player-container')?.classList.add('hidden');
                 document.getElementById('mood-selection')?.classList.remove('hidden');
             }
         });
     }
     // Note: Play/Pause button listener is likely handled within audio-player.js's init function.
}

/**
 * Setup listeners related to the API Key modal.
 */
function setupApiKeyModal() {
    const saveButton = document.getElementById('save-api-key');
    const resetButton = document.getElementById('reset-api-key');
    const modal = document.getElementById('api-key-prompt');
    const apiKeyInput = document.getElementById('api-key-input');

    if (saveButton) {
        saveButton.addEventListener('click', saveApiKey);
    }
    if (resetButton) {
        resetButton.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            pendingMood = null; // Clear any pending mood when manually resetting
            showApiKeyModal();
        });
    }
     // Optional: Allow pressing Enter in the input field to save the key
     if (apiKeyInput) {
         apiKeyInput.addEventListener('keypress', (e) => {
             if (e.key === 'Enter') {
                 saveApiKey();
             }
         });
     }
}


/**
 * Show the API key input modal.
 */
function showApiKeyModal() {
    const modal = document.getElementById('api-key-prompt');
    const apiKeyInput = document.getElementById('api-key-input');
    const messageElement = document.getElementById('api-key-message'); // Get the message element

    if (modal) {
        modal.classList.remove('hidden');
        // Clear previous messages and input value
        if (messageElement) messageElement.textContent = '';
        if (apiKeyInput) {
             apiKeyInput.value = ''; // Clear previous input
             apiKeyInput.focus(); // Focus on the input field
        }
    } else {
        console.error("API Key Modal element not found.");
    }
}

/**
 * Save the entered API key, hide the modal, and start music if a mood was pending.
 */
function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input');
    const modal = document.getElementById('api-key-prompt');
    const messageElement = document.getElementById('api-key-message'); // Get the message element
    let apiKey = '';

    if (apiKeyInput) {
        apiKey = apiKeyInput.value.trim();
    } else {
         console.error("API Key input element not found.");
         if (messageElement) messageElement.textContent = '发生内部错误。'; // Internal error occurred.
         return;
    }

    // Clear previous message
    if (messageElement) messageElement.textContent = '';

    if (apiKey && window.MoodFlowAPI && typeof window.MoodFlowAPI.setApiToken === 'function') {
        window.MoodFlowAPI.setApiToken(apiKey);
        console.log("API Key saved.");
        if (modal) {
            modal.classList.add('hidden');
        }

        // **Refined Logic:** If a mood was selected before the modal was shown, start playing it now.
        if (pendingMood) {
            console.log(`API Key saved, starting pending mood: ${pendingMood}`);
            if (window.MoodFlowPlayer && typeof window.MoodFlowPlayer.startMusicByMood === 'function') {
                window.MoodFlowPlayer.startMusicByMood(pendingMood);
            } else {
                 console.error("MoodFlowPlayer.startMusicByMood is not defined.");
                 updateStatusMessage("错误：无法启动音乐。", true); // Error: Cannot start music.
            }
            pendingMood = null; // Clear the pending mood after attempting to start
        }
    } else {
        console.warn("API Key input was empty or MoodFlowAPI.setApiToken is not available.");
        // **Refined Error Display:** Show error message inside the modal instead of alert()
        if (messageElement) {
            messageElement.textContent = '请输入有效的API密钥。'; // Please enter a valid API key.
        }
        if (apiKeyInput) {
             apiKeyInput.focus(); // Keep focus on input
        }
    }
}

/**
 * Setup audio preview on mood card hover.
 * Uses external sample URLs as placeholders.
 */
function setupAudioPreview() {
    // Placeholder preview audio URLs (replace with actual short samples if possible)
    const previewAudios = {
        'calm-focus': 'https://assets.mixkit.co/sfx/preview/mixkit-soft-game-notification-970.mp3', // Different samples
        'energetic-morning': 'https://assets.mixkit.co/sfx/preview/mixkit-positive-interface-beep-221.mp3',
        'relaxing-night': 'https://assets.mixkit.co/sfx/preview/mixkit-interface-hint-notification-911.mp3',
        'cafe-vibe': 'https://assets.mixkit.co/sfx/preview/mixkit-bonus-extra-in-a-video-game-2064.mp3'
    };

    let previewAudio = null; // Initialize lazily
    let currentPreviewMood = null;
    let previewTimeout = null; // To add a slight delay before playing

    document.querySelectorAll('.mood-card').forEach(card => {
        const mood = card.getAttribute('data-mood');
        const previewUrl = card.getAttribute('data-preview') || previewAudios[mood]; // Prefer data-preview if set in HTML

        if (!previewUrl) return; // Skip if no preview URL

        card.addEventListener('mouseenter', () => {
            // Clear any previous timeout
            if (previewTimeout) clearTimeout(previewTimeout);

            // Set a short delay to prevent accidental plays while moving mouse quickly
            previewTimeout = setTimeout(() => {
                if (!previewAudio) { // Create Audio object only when first needed
                    previewAudio = new Audio();
                    previewAudio.volume = 0.4; // Adjust volume as needed
                    previewAudio.preload = "auto"; // Preload the audio
                     // Handle potential errors during playback
                     previewAudio.addEventListener('error', (e) => {
                         console.warn(`无法播放预览音频 (Cannot play preview audio) for ${currentPreviewMood}:`, e);
                     });
                }

                // Stop any currently playing preview
                if (currentPreviewMood && currentPreviewMood !== mood) {
                    previewAudio.pause();
                    previewAudio.currentTime = 0;
                }

                // Play the new preview if it's different
                if (currentPreviewMood !== mood) {
                    currentPreviewMood = mood;
                    previewAudio.src = previewUrl;
                    previewAudio.play().catch(error => {
                        // Catch errors, e.g., user hasn't interacted with the page yet
                        console.warn(`无法自动播放预览音频 (Cannot autoplay preview audio) for ${mood}:`, error.message);
                    });
                }
            }, 150); // 150ms delay
        });

        card.addEventListener('mouseleave', () => {
            // Clear the timeout and stop playback when mouse leaves
            if (previewTimeout) clearTimeout(previewTimeout);
            if (previewAudio && currentPreviewMood === mood) {
                previewAudio.pause();
                previewAudio.currentTime = 0;
                currentPreviewMood = null;
            }
        });

        // Removed the 'selected' class logic from here as it's not needed for the refined API key flow.
        // If you need visual feedback on click *before* music starts, add it back or handle it in setupMoodCards.
    });
}


/**
 * Setup listeners to update the audio player's time display.
 */
function setupTimeDisplay() {
    const audioPlayer = document.getElementById('audio-player');
    const currentTimeElement = document.getElementById('current-time');
    const durationElement = document.getElementById('duration');

    if (!audioPlayer || !currentTimeElement || !durationElement) {
        console.error("Audio player time display elements not found.");
        return;
    }

    // Function to format time in M:SS format
    const formatTime = (time) => {
        if (isNaN(time) || time === Infinity) {
            return '0:00'; // Return default if time is invalid
        }
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Update display based on player events
    const updateDisplay = () => {
        currentTimeElement.textContent = formatTime(audioPlayer.currentTime);
        // Only update duration if it's a valid number
        if (isFinite(audioPlayer.duration)) {
            durationElement.textContent = formatTime(audioPlayer.duration);
        } else {
             durationElement.textContent = '0:00'; // Reset if duration is not available
        }
    };

    audioPlayer.addEventListener('timeupdate', updateDisplay);
    audioPlayer.addEventListener('loadedmetadata', updateDisplay);
    // Also update when the duration changes (can happen with streaming/loading)
    audioPlayer.addEventListener('durationchange', updateDisplay);
     // Reset display when audio ends or is stopped/changed
     audioPlayer.addEventListener('ended', () => {
         // Optionally reset progress bar here too if not handled by player module
         currentTimeElement.textContent = '0:00';
     });
     audioPlayer.addEventListener('emptied', () => { // Fired when src is changed
         currentTimeElement.textContent = '0:00';
         durationElement.textContent = '0:00';
     });
}

/**
 * Display an error message to the user (using status message area instead of alert).
 * @param {string} message - The error message to display.
 * @param {boolean} isCritical - Optional flag for critical errors.
 */
function showError(message) {
    console.error("Error displayed to user:", message); // Log the error for debugging

    // **Refined Error Display:** Use the status message area
    updateStatusMessage(`错误: ${message}`, true); // Error: [message]

    // Provide specific guidance for common issues
    if (message.includes('跨域') || message.includes('CORS') || message.includes('cross-origin') || message.includes('Failed to fetch')) {
         if (window.location.protocol === 'file:') {
            updateStatusMessage('错误：跨域请求被阻止。请使用本地HTTP服务器运行。', true); // Error: CORS blocked. Use local HTTP server.
         } else {
            updateStatusMessage('错误：网络请求失败。请检查网络连接或浏览器控制台。', true); // Error: Network request failed. Check connection/console.
         }
    } else if (message.includes('API密钥') || message.includes('Token') || message.includes('token') || message.includes('认证失败') || message.includes('需要付费')) {
        // If error is related to API key, show the modal again
        showApiKeyModal();
        // Also display error in the modal's message area
        const modalMessageElement = document.getElementById('api-key-message');
        if (modalMessageElement) {
            modalMessageElement.textContent = message; // Show specific error in modal
        }
    }
    // Potentially hide loading indicator if an error occurs during generation
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
}

/**
 * Updates the status message display area.
 * @param {string} message - The message to display.
 * @param {boolean} isError - Optional flag to style as an error.
 */
function updateStatusMessage(message, isError = false) {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
        statusElement.textContent = message;
        if (isError) {
            statusElement.classList.add('text-red-500', 'font-semibold'); // Add error styling (Tailwind example)
             statusElement.classList.remove('text-gray-600');
        } else {
            statusElement.classList.remove('text-red-500', 'font-semibold');
             statusElement.classList.add('text-gray-600'); // Reset to default style
        }
    } else {
        console.log("Status Update:", message); // Fallback log if element not found
    }
}


// Expose necessary functions/variables to the global scope if needed by other scripts
// (Consider using JS Modules for better organization in larger projects)
window.showError = showError; // Make showError globally accessible if needed by api.js or audio-player.js
window.updateStatusMessage = updateStatusMessage; // Make status update globally accessible

