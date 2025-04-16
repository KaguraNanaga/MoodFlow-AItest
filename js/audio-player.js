/**
 * 音频播放器模块 - 负责管理音频播放和无缝切换
 */

// 播放器状态
const playerState = {
    currentMood: null,
    isPlaying: false,
    audioQueue: [], // 音频队列存储下一首歌
    currentAudioUrl: null,
    advanceRequestTime: 30 // 提前多少秒请求下一首歌
};

// DOM元素
let audioElement;
let progressElement;
let statusMessageElement;
let currentMoodTextElement;
let playPauseButton;
let playIcon;
let pauseIcon;

/**
 * 初始化音频播放器
 */
function initAudioPlayer() {
    // 获取DOM元素
    audioElement = document.getElementById('audio-player');
    progressElement = document.getElementById('progress');
    statusMessageElement = document.getElementById('status-message');
    currentMoodTextElement = document.getElementById('current-mood-text');
    playPauseButton = document.getElementById('play-pause-btn');
    playIcon = document.getElementById('play-icon');
    pauseIcon = document.getElementById('pause-icon');

    // 设置事件监听器
    audioElement.addEventListener('timeupdate', updateProgressBar);
    audioElement.addEventListener('ended', playNextInQueue);
    audioElement.addEventListener('error', handleAudioError);
    playPauseButton.addEventListener('click', togglePlayPause);

    // 如果浏览器支持媒体会话API，配置媒体会话
    if ('mediaSession' in navigator) {
        setupMediaSession();
    }
}

/**
 * 根据选择的情绪开始播放音乐
 * @param {string} mood - 情绪类型
 */
async function startMusicByMood(mood) {
    if (!window.MoodFlowAPI.isApiTokenSet()) {
        showStatusMessage('请先设置API密钥');
        return;
    }

    // 检查是否在本地文件系统运行
    if (window.location.protocol === 'file:') {
        showStatusMessage('注意：直接从文件系统打开网页可能导致API请求失败。建议使用本地服务器运行应用。');
    }

    // 更新状态
    playerState.currentMood = mood;
    
    // 更新界面
    showPlayerInterface();
    currentMoodTextElement.textContent = window.MoodFlowAPI.MOOD_NAMES[mood];
    showStatusMessage('正在生成音乐，请稍候...');
    
    try {
        // 生成第一首歌曲
        const audioUrl = await window.MoodFlowAPI.generateMusic(mood);
        
        // 检查返回的URL是否有效
        if (!audioUrl) {
            throw new Error('生成的音乐URL无效');
        }
        
        // 开始播放
        playAudio(audioUrl);
        // 预先准备下一首
        requestNextSong();
    } catch (error) {
        const errorMsg = `音乐生成失败: ${error.message}`;
        showStatusMessage(errorMsg);
        console.error(error);
        
        // 显示提示并返回选择界面
        setTimeout(() => {
            if (typeof window.showError === 'function') {
                window.showError(error.message);
            } else {
                alert(errorMsg);
            }
            showMoodSelection();
        }, 2000);
    }
}

/**
 * 播放音频
 * @param {string} audioUrl - 音频URL
 */
function playAudio(audioUrl) {
    playerState.currentAudioUrl = audioUrl;
    audioElement.src = audioUrl;
    audioElement.load();
    
    audioElement.play()
        .then(() => {
            playerState.isPlaying = true;
            updatePlayPauseButton();
            showStatusMessage('正在播放');
        })
        .catch(error => {
            console.error('播放失败:', error);
            showStatusMessage('播放失败，请重试');
        });
}

/**
 * 请求下一首歌曲
 */
async function requestNextSong() {
    if (!playerState.currentMood) return;
    
    try {
        showStatusMessage('准备下一首歌曲...');
        // 生成下一首歌
        const nextAudioUrl = await window.MoodFlowAPI.generateMusic(playerState.currentMood);
        // 加入队列
        playerState.audioQueue.push(nextAudioUrl);
        showStatusMessage('下一首歌曲已准备就绪');
    } catch (error) {
        console.error('生成下一首歌曲失败:', error);
        showStatusMessage('下一首歌曲准备失败，将在当前歌曲结束后重试');
    }
}

/**
 * 播放队列中的下一首歌
 */
function playNextInQueue() {
    if (playerState.audioQueue.length > 0) {
        // 播放队列中的第一首歌
        const nextAudioUrl = playerState.audioQueue.shift();
        playAudio(nextAudioUrl);
        // 再次请求下一首
        requestNextSong();
    } else {
        // 队列为空，重新请求当前情绪的歌曲
        startMusicByMood(playerState.currentMood);
    }
}

/**
 * 切换播放/暂停状态
 */
function togglePlayPause() {
    if (playerState.isPlaying) {
        audioElement.pause();
        playerState.isPlaying = false;
    } else {
        audioElement.play()
            .then(() => {
                playerState.isPlaying = true;
            })
            .catch(error => {
                console.error('恢复播放失败:', error);
                showStatusMessage('恢复播放失败');
            });
    }
    updatePlayPauseButton();
}

/**
 * 更新播放/暂停按钮显示
 */
function updatePlayPauseButton() {
    if (playerState.isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }
}

/**
 * 更新进度条
 */
function updateProgressBar() {
    if (audioElement.duration) {
        const progress = (audioElement.currentTime / audioElement.duration) * 100;
        progressElement.style.width = `${progress}%`;
        
        // 如果还有足够时长，并且队列为空，请求下一首
        const timeRemaining = audioElement.duration - audioElement.currentTime;
        if (timeRemaining <= playerState.advanceRequestTime && playerState.audioQueue.length === 0) {
            requestNextSong();
        }
    }
}

/**
 * 处理音频错误
 */
function handleAudioError(event) {
    console.error('音频播放错误:', event);
    showStatusMessage('播放出错，正在尝试下一首');
    
    // 如果队列中有歌曲，尝试播放下一首
    if (playerState.audioQueue.length > 0) {
        playNextInQueue();
    } else {
        // 尝试重新生成
        startMusicByMood(playerState.currentMood);
    }
}

/**
 * 显示播放器界面
 */
function showPlayerInterface() {
    document.getElementById('mood-selection').classList.add('hidden');
    document.getElementById('player-container').classList.remove('hidden');
}

/**
 * 显示情绪选择界面
 */
function showMoodSelection() {
    document.getElementById('mood-selection').classList.remove('hidden');
    document.getElementById('player-container').classList.add('hidden');
    
    // 停止当前播放
    audioElement.pause();
    playerState.isPlaying = false;
    playerState.currentMood = null;
    playerState.audioQueue = [];
    updatePlayPauseButton();
}

/**
 * 显示状态消息
 * @param {string} message - 状态消息
 */
function showStatusMessage(message) {
    statusMessageElement.textContent = message;
}

/**
 * 配置媒体会话（用于浏览器媒体控制）
 */
function setupMediaSession() {
    navigator.mediaSession.setActionHandler('play', () => {
        audioElement.play();
        playerState.isPlaying = true;
        updatePlayPauseButton();
    });
    
    navigator.mediaSession.setActionHandler('pause', () => {
        audioElement.pause();
        playerState.isPlaying = false;
        updatePlayPauseButton();
    });
    
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNextInQueue();
    });
}

// 导出音频播放器功能
window.MoodFlowPlayer = {
    init: initAudioPlayer,
    startMusicByMood: startMusicByMood,
    showMoodSelection: showMoodSelection,
    togglePlayPause: togglePlayPause
}; 