/**
 * API Handler Module - Responsible for communicating with the Replicate API
 */

// Replicate API Configuration
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
// User API Key - Initialized as empty, needs user input
let REPLICATE_API_TOKEN = '';

// Mood prompts mapping (Using English prompts as likely expected by the model)
// These prompts are based on your initial project description.
// You should test and refine these prompts based on the actual output of minimax/music-01.
const MOOD_PROMPTS = {
    'calm-focus': "instrumental, lofi hip hop, calm, focus, study beats, low tempo, no vocals, simple bassline, soft drums, 70 bpm",
    'energetic-morning': "upbeat instrumental, acoustic guitar, light percussion, positive energy, morning vibe, walking tempo, happy melody, 110 bpm",
    'relaxing-night': "ambient music, relaxing, sleep, calm, synthesizer pads, slow tempo, minimal, atmospheric, 60 bpm",
    'cafe-vibe': "jazz hop, cafe ambience, instrumental, relaxed, coffee shop background music, moderate tempo, saxophone hints, 85 bpm" // Adjusted from original description for clarity
};

// Mood names in Chinese (for display purposes)
const MOOD_NAMES = {
    'calm-focus': '宁静专注',
    'energetic-morning': '活力晨间',
    'relaxing-night': '舒缓夜晚',
    'cafe-vibe': '咖啡馆氛围'
};

/**
 * Set the API token and save it to localStorage.
 * @param {string} token - The Replicate API token.
 */
function setApiToken(token) {
    REPLICATE_API_TOKEN = token;
    try {
        localStorage.setItem('replicate_api_token', token);
    } catch (error) {
        console.warn('Could not save API token to localStorage. Browser restrictions or private mode might be active.', error);
    }
}

/**
 * Load the API token from localStorage if available.
 * @returns {boolean} - True if a token was loaded, false otherwise.
 */
function loadApiToken() {
    try {
        const savedToken = localStorage.getItem('replicate_api_token');
        if (savedToken) {
            REPLICATE_API_TOKEN = savedToken;
            return true;
        }
    } catch (error) {
        console.warn('Could not read API token from localStorage. Browser restrictions or private mode might be active.', error);
    }
    return false;
}

/**
 * Check if the API token is set.
 * @returns {boolean} - True if the token is set, false otherwise.
 */
function isApiTokenSet() {
    return !!REPLICATE_API_TOKEN && REPLICATE_API_TOKEN.trim() !== '';
}

/**
 * Generate music based on the selected mood by calling the Replicate API.
 * @param {string} mood - The selected mood key (e.g., 'calm-focus').
 * @returns {Promise<string>} - A promise that resolves with the URL of the generated audio file.
 * @throws {Error} - Throws an error if the API key is not set, the mood is invalid, or the API call fails.
 */
async function generateMusic(mood) {
    if (!isApiTokenSet()) {
        // Don't proceed if API key is missing
        throw new Error('API密钥未设置，请先设置API密钥'); // API key not set, please set it first
    }

    if (!MOOD_PROMPTS[mood]) {
        // Handle invalid mood selection
        throw new Error('无效的情绪类型'); // Invalid mood type
    }

    // --- Use the correct prompt text for the selected mood ---
    const lyricsText = MOOD_PROMPTS[mood]; // Get the English prompt text
    const musicDuration = 90; // Example duration in seconds. Verify parameter name and units with Replicate docs!
    // --- Verify this version ID on the Replicate model page! ---
    const modelVersion = "9a423b48397ce2d82e2fc5be17cc6c273cc129cf70e0f44a911d6b0385853b4e";

    console.log(`Generating music for mood: ${mood} with lyrics: "${lyricsText}" and duration: ${musicDuration}s`);

    try {
        // Step 1: Create the prediction request
        const initialResponse = await fetch(REPLICATE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            // --- *** KEY CHANGE HERE *** ---
            // Use 'lyrics' as the parameter name based on the Python example.
            // Keep 'duration' assuming it's supported. Verify on Replicate docs.
            body: JSON.stringify({
                version: modelVersion,
                input: {
                    lyrics: lyricsText, // Use 'lyrics' instead of 'prompt'
                    duration: musicDuration // Assuming the parameter is named 'duration' and expects seconds
                    // Add other parameters like temperature if needed/supported
                    // song_file: null // Explicitly null or omit if not used
                }
            })
        });

        // Handle initial network errors or non-OK responses
        if (!initialResponse.ok) {
            let errorData;
            try {
                errorData = await initialResponse.json();
                console.error("API Error Response:", errorData); // Log the detailed error from API
            } catch (e) {
                errorData = { detail: '无法解析错误响应' }; // Cannot parse error response
            }
            // Provide more specific feedback based on status code
            if (initialResponse.status === 401) {
                 throw new Error(`API请求失败: 认证失败 (401)。请检查你的API密钥是否正确且有效。`); // Authentication failed. Check your API key.
            } else if (initialResponse.status === 402) {
                 throw new Error(`API请求失败: 需要付费 (402)。请检查你的Replicate账户余额或计划。`); // Payment required. Check your Replicate account.
            } else if (initialResponse.status === 429) {
                 throw new Error(`API请求失败: 请求过于频繁 (429)。请稍后再试。`); // Rate limit exceeded. Try again later.
            } else if (initialResponse.status === 422) {
                 // 422 often means invalid input parameters
                 throw new Error(`API请求失败: 输入无效 (422)。请检查模型版本和输入参数（如lyrics, duration）。详情: ${errorData.detail || '无'}`);
            } else {
                throw new Error(`API请求失败: ${errorData.detail || initialResponse.statusText} (${initialResponse.status})`);
            }
        }

        const predictionData = await initialResponse.json();
        const predictionId = predictionData.id;

        if (!predictionId) {
             throw new Error('未能从API响应中获取预测ID'); // Failed to get prediction ID from API response
        }

        console.log(`Prediction started with ID: ${predictionId}`);
        // Use the globally available updateStatusMessage function from app.js
        if (typeof window.updateStatusMessage === 'function') {
             window.updateStatusMessage(`正在生成音乐 (ID: ${predictionId.substring(0, 6)})...`); // Generating music...
        }


        // Step 2: Poll for the prediction result (No changes needed in polling logic itself)
        return await pollPredictionResult(predictionId);

    } catch (error) {
        // Catch and log errors from the fetch or polling process
        console.error('生成音乐时出错 (Error during music generation):', error);
        // Display specific CORS error message if detected
         if (error.message.includes('Failed to fetch') && navigator.onLine === false) {
             throw new Error('网络连接已断开。请检查您的网络连接。'); // Network connection lost.
         } else if (error.message.includes('Failed to fetch') || error.message.includes('CORS') || error.message.includes('跨域')) {
             // Check if running locally via file://
             if (window.location.protocol === 'file:') {
                  throw new Error('跨域请求被阻止。请使用本地HTTP服务器 (例如 VS Code Live Server 或 python -m http.server) 运行此应用，而不是直接打开HTML文件。'); // CORS blocked. Use a local HTTP server.
             } else {
                  throw new Error(`网络请求失败。可能是 CORS 问题或网络连接问题。请检查浏览器控制台获取详细信息。(${error.message})`); // Network request failed. Check console.
             }
         }
        // Re-throw the original or modified error
        throw error;
    }
}

/**
 * Poll the Replicate API for the prediction result.
 * @param {string} predictionId - The ID of the prediction to poll.
 * @returns {Promise<string>} - A promise that resolves with the URL of the generated audio file.
 * @throws {Error} - Throws an error if polling fails, the prediction fails, or it times out.
 */
async function pollPredictionResult(predictionId) {
    const maxAttempts = 60; // Max polling attempts (e.g., 60 * 3s = 3 minutes)
    const pollInterval = 3000; // Polling interval in milliseconds (e.g., 3 seconds)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        console.log(`Polling attempt ${attempt + 1} for prediction ID: ${predictionId}`);
        // Wait *before* the next poll attempt
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        try {
            const pollResponse = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
                headers: {
                    'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                    'Content-Type': 'application/json'
                    // 'Accept': 'application/json' // Explicitly accept JSON
                }
            });

            if (!pollResponse.ok) {
                 // Handle specific polling errors if needed
                 if (pollResponse.status === 404) {
                     throw new Error(`轮询失败: 找不到预测任务 (404)。ID 可能无效或已过期。`); // Polling failed: Prediction not found.
                 }
                throw new Error(`轮询失败: ${pollResponse.statusText} (${pollResponse.status})`); // Polling failed
            }

            const result = await pollResponse.json();
            console.log("Polling result:", result); // Log the polling response for debugging

            // Check the prediction status
            if (result.status === 'succeeded') {
                console.log('音乐生成成功！(Music generation successful!)');
                 if (typeof window.updateStatusMessage === 'function') {
                    window.updateStatusMessage('音乐生成成功！'); // Music generation successful!
                 }
                // Ensure the output is the expected audio URL string
                if (typeof result.output === 'string' && result.output.startsWith('http')) {
                     return result.output;
                } else {
                     // Handle cases where output might be different (e.g., array, object)
                     console.error("Unexpected output format from Replicate:", result.output);
                     // Attempt to find a URL if output is an array
                     if (Array.isArray(result.output) && result.output.length > 0 && typeof result.output[0] === 'string' && result.output[0].startsWith('http')) {
                         console.warn("Output was an array, using the first element.");
                         return result.output[0];
                     }
                     throw new Error('音乐生成成功，但未能获取有效的音频URL。'); // Succeeded, but couldn't get a valid audio URL.
                }
            } else if (result.status === 'failed') {
                console.error('音乐生成失败 (Music generation failed by Replicate). Error details:', result.error);
                // Log the specific error from Replicate
                throw new Error(`音乐生成失败: ${result.error || '未知错误'}`); // Music generation failed: [API error or 'Unknown error']
            } else if (result.status === 'canceled') {
                 console.warn('音乐生成任务已被取消。(Music generation task was cancelled.)');
                 throw new Error('音乐生成任务已被取消。');
            }
             // If status is 'starting' or 'processing', continue polling
            console.log(`当前状态 (Current status): ${result.status}. 继续轮询... (Continuing polling...)`);
             if (typeof window.updateStatusMessage === 'function') {
                 window.updateStatusMessage(`正在生成音乐 (${result.status})...`); // Update status for user (Generating music...)
             }

        } catch (error) {
            console.error('轮询预测结果时出错 (Error during polling):', error);
            // Don't immediately throw if it's just one failed poll attempt, unless it's a fatal error like 404
            if (error.message.includes('404')) {
                 throw error; // Re-throw fatal errors immediately
            }
            // For other errors, log and continue polling unless max attempts are reached
             if (attempt === maxAttempts - 1) {
                 throw new Error(`轮询时发生错误，已达最大尝试次数。(${error.message})`); // Error during polling, max attempts reached.
             }
        }
    }

    // If loop finishes without success/failure, it's a timeout
    console.error('生成音乐超时 (Music generation timed out).');
    throw new Error('生成音乐超时，请稍后重试'); // Generation timed out, please try again later
}


// Expose API functions to the global scope (consider using modules if scaling)
window.MoodFlowAPI = {
    setApiToken,
    loadApiToken,
    isApiTokenSet,
    generateMusic,
    MOOD_PROMPTS, // Keep prompts accessible if needed elsewhere
    MOOD_NAMES    // Keep names accessible for UI updates
};

console.log("MoodFlowAPI loaded (using 'lyrics' input)."); // Log to confirm script loading and change
