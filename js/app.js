/**
 * MoodFlow AI - 主应用逻辑
 */

// 当文档加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);

/**
 * 初始化应用
 */
function initApp() {
    // 初始化音频播放器
    window.MoodFlowPlayer.init();
    
    // 更新页脚年份
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // 检查环境
    checkEnvironment();
    
    // 检查是否已保存API密钥
    if (window.MoodFlowAPI.loadApiToken()) {
        console.log('已加载已保存的API密钥');
    } else {
        // 显示API密钥输入对话框
        showApiKeyModal();
    }
    
    // 为情绪卡片添加点击事件
    setupMoodCards();
    
    // 为切换情绪按钮添加点击事件
    document.getElementById('change-mood-btn').addEventListener('click', () => {
        window.MoodFlowPlayer.showMoodSelection();
    });
    
    // 为保存API密钥按钮添加点击事件
    document.getElementById('save-api-key').addEventListener('click', saveApiKey);
    
    // 为重置API密钥链接添加点击事件
    document.getElementById('reset-api-key').addEventListener('click', (e) => {
        e.preventDefault();
        showApiKeyModal();
    });
    
    // 添加预览音频功能，当鼠标悬停在卡片上时播放示例音频
    setupAudioPreview();
    
    // 设置时间显示更新
    setupTimeDisplay();
}

/**
 * 检查运行环境
 */
function checkEnvironment() {
    // 检查是否在本地文件系统运行
    if (window.location.protocol === 'file:') {
        console.warn('应用正在以本地文件形式运行，API功能可能受限。建议使用HTTP服务器运行。');
        
        // 在页面顶部显示提示信息
        const warningDiv = document.createElement('div');
        warningDiv.className = 'environment-warning';
        warningDiv.innerHTML = `
            <p>⚠️ 您正在直接从文件系统打开本应用，某些功能可能无法正常工作。</p>
            <p>建议使用本地服务器运行，例如使用Python命令：<code>python -m http.server</code></p>
            <button id="close-warning">我知道了</button>
        `;
        document.body.insertBefore(warningDiv, document.body.firstChild);
        
        // 添加关闭按钮功能
        document.getElementById('close-warning').addEventListener('click', () => {
            warningDiv.style.display = 'none';
        });
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .environment-warning {
                background-color: #fff3cd;
                color: #856404;
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 15px;
                text-align: center;
                position: sticky;
                top: 0;
                z-index: 100;
            }
            .environment-warning code {
                background-color: rgba(0,0,0,0.1);
                padding: 2px 5px;
                border-radius: 3px;
            }
            .environment-warning button {
                background-color: #856404;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                margin-top: 5px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 检查网络连接
    if (!navigator.onLine) {
        console.warn('设备当前离线，API功能将无法正常工作。');
        showError('您的设备当前处于离线状态，请连接网络后再使用本应用。');
    }
    
    // 监听网络状态变化
    window.addEventListener('online', () => {
        console.log('网络已连接');
    });
    
    window.addEventListener('offline', () => {
        console.warn('网络已断开');
        showError('网络连接已断开，API功能将无法正常工作。');
    });
}

/**
 * 为情绪卡片添加点击事件
 */
function setupMoodCards() {
    const moodCards = document.querySelectorAll('.mood-card');
    
    moodCards.forEach(card => {
        card.addEventListener('click', () => {
            const mood = card.getAttribute('data-mood');
            
            // 检查API密钥是否设置
            if (!window.MoodFlowAPI.isApiTokenSet()) {
                showApiKeyModal(() => {
                    window.MoodFlowPlayer.startMusicByMood(mood);
                });
                return;
            }
            
            // 开始播放选定情绪的音乐
            window.MoodFlowPlayer.startMusicByMood(mood);
        });
    });
}

/**
 * 显示API密钥输入对话框
 * @param {Function} callback - 设置完成后的回调函数
 */
function showApiKeyModal(callback) {
    const modal = document.getElementById('api-key-prompt');
    modal.classList.remove('hidden');
    
    // 保存回调函数，当保存API密钥时使用
    modal.dataset.callback = callback ? 'true' : 'false';
    
    // 聚焦到输入框
    document.getElementById('api-key-input').focus();
}

/**
 * 保存API密钥
 */
function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKey = apiKeyInput.value.trim();
    const modal = document.getElementById('api-key-prompt');
    
    if (apiKey) {
        window.MoodFlowAPI.setApiToken(apiKey);
        modal.classList.add('hidden');
        
        // 如果有回调函数，执行它
        if (modal.dataset.callback === 'true') {
            // 清除回调标记
            modal.dataset.callback = 'false';
            // 获取用户点击的情绪卡片
            const moodCards = document.querySelectorAll('.mood-card');
            for (const card of moodCards) {
                if (card.classList.contains('selected')) {
                    const mood = card.getAttribute('data-mood');
                    window.MoodFlowPlayer.startMusicByMood(mood);
                    break;
                }
            }
        }
    } else {
        alert('请输入有效的API密钥');
    }
}

/**
 * 设置音频预览功能
 * 注意：在实际应用中，你需要预先为每个情绪准备短音频样本
 * 这里仅演示功能，实际实现中需要预先生成并保存多个样本
 */
function setupAudioPreview() {
    // 由于预览音频文件可能不存在，我们将使用在线免费音频样本
    const previewAudios = {
        'calm-focus': 'https://assets.mixkit.co/sfx/preview/mixkit-warm-notification-bell-951.mp3',
        'energetic-morning': 'https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3',
        'relaxing-night': 'https://assets.mixkit.co/sfx/preview/mixkit-little-bird-singing-in-a-tree-17.mp3',
        'cafe-vibe': 'https://assets.mixkit.co/sfx/preview/mixkit-guitar-notification-alert-2320.mp3'
    };
    
    // 创建预览音频元素
    const previewAudio = new Audio();
    previewAudio.volume = 0.5;
    
    // 当前预览的情绪
    let currentPreview = null;
    
    // 为每个情绪卡片添加鼠标事件
    document.querySelectorAll('.mood-card').forEach(card => {
        const mood = card.getAttribute('data-mood');
        
        // 鼠标进入时播放预览
        card.addEventListener('mouseenter', () => {
            if (previewAudios[mood]) {
                currentPreview = mood;
                previewAudio.src = previewAudios[mood];
                previewAudio.play().catch(error => {
                    console.warn('无法播放预览音频:', error);
                });
            }
        });
        
        // 鼠标离开时停止预览
        card.addEventListener('mouseleave', () => {
            if (currentPreview === mood) {
                previewAudio.pause();
                previewAudio.currentTime = 0;
                currentPreview = null;
            }
        });
        
        // 点击时添加选中状态（用于API密钥对话框回调）
        card.addEventListener('click', () => {
            document.querySelectorAll('.mood-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
}

/**
 * 设置时间显示更新
 */
function setupTimeDisplay() {
    const audioPlayer = document.getElementById('audio-player');
    const currentTimeElement = document.getElementById('current-time');
    const durationElement = document.getElementById('duration');
    
    // 更新时间显示
    function updateTimeDisplay() {
        // 格式化时间为分:秒格式
        const formatTime = (time) => {
            const minutes = Math.floor(time / 60);
            const seconds = Math.floor(time % 60);
            return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        };
        
        currentTimeElement.textContent = formatTime(audioPlayer.currentTime);
        if (!isNaN(audioPlayer.duration)) {
            durationElement.textContent = formatTime(audioPlayer.duration);
        }
    }
    
    // 添加事件监听器
    audioPlayer.addEventListener('timeupdate', updateTimeDisplay);
    audioPlayer.addEventListener('loadedmetadata', updateTimeDisplay);
}

/**
 * 显示错误消息
 * @param {string} message - 错误消息
 */
function showError(message) {
    // 检查是否为CORS或本地文件系统相关错误
    if (message.includes('跨域') || message.includes('CORS') || message.includes('cross-origin')) {
        alert(`错误: ${message}\n\n如果您是直接从文件系统打开网页，建议按照以下步骤操作：\n1. 使用Python启动本地服务器: python -m http.server\n2. 在浏览器中访问: http://localhost:8000`);
    } else if (message.includes('API密钥')) {
        alert(`错误: ${message}\n\n请确保输入了有效的Replicate API密钥。您可以在Replicate账户设置中获取密钥。`);
    } else {
        alert(`错误: ${message}`);
    }
    
    // 如果错误与API密钥有关，显示API密钥输入对话框
    if (message.includes('API密钥') || message.includes('Token') || message.includes('token')) {
        showApiKeyModal();
    }
}

// 导出函数供其他模块使用
window.showError = showError; 