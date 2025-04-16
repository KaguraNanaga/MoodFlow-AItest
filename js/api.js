/**
 * API处理模块 - 负责与Replicate API通信
 */

// Replicate API配置
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
// 用户API密钥 - 初始化为空，需要用户输入
let REPLICATE_API_TOKEN = ''; 

// 各情绪对应的歌词映射
const MOOD_PROMPTS = {
    'calm-focus': '平静的钢琴旋律，轻柔的节奏，帮助专注工作和学习的音乐',
    'energetic-morning': '充满活力的早晨音乐，积极向上的旋律，让人精神振奋',
    'relaxing-night': '舒缓的夜晚旋律，柔和的合成器声音，助眠放松的音乐',
    'cafe-vibe': '咖啡馆爵士氛围，钢琴与低音贝斯，温暖舒适的背景音乐'
};

// 情绪对应的中文名称
const MOOD_NAMES = {
    'calm-focus': '宁静专注',
    'energetic-morning': '活力晨间',
    'relaxing-night': '舒缓夜晚',
    'cafe-vibe': '咖啡馆氛围'
};

/**
 * 设置API令牌
 * @param {string} token - API密钥
 */
function setApiToken(token) {
    REPLICATE_API_TOKEN = token;
    try {
        localStorage.setItem('replicate_api_token', token);
    } catch (error) {
        console.warn('无法保存API密钥到localStorage，可能是因为浏览器限制或隐私设置', error);
    }
}

/**
 * 从localStorage加载API令牌（如果有）
 */
function loadApiToken() {
    try {
        const savedToken = localStorage.getItem('replicate_api_token');
        if (savedToken) {
            REPLICATE_API_TOKEN = savedToken;
            return true;
        }
    } catch (error) {
        console.warn('无法从localStorage读取API密钥，可能是因为浏览器限制或隐私设置', error);
    }
    return false;
}

/**
 * 检查API令牌是否已设置
 * @returns {boolean} - 是否已设置API令牌
 */
function isApiTokenSet() {
    return !!REPLICATE_API_TOKEN && REPLICATE_API_TOKEN.trim() !== '';
}

/**
 * 根据情绪生成音乐
 * @param {string} mood - 情绪类型
 * @returns {Promise} - 包含生成音乐URL的Promise
 */
async function generateMusic(mood) {
    if (!isApiTokenSet()) {
        throw new Error('API密钥未设置，请先设置API密钥');
    }

    if (!MOOD_PROMPTS[mood]) {
        throw new Error('无效的情绪类型');
    }

    const lyrics = MOOD_PROMPTS[mood];
    
    try {
        // 1. 创建预测请求
        const response = await fetch(REPLICATE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                version: "9a423b48397ce2d82e2fc5be17cc6c273cc129cf70e0f44a911d6b0385853b4e", // minimax/music-01版本ID
                input: {
                    lyrics: lyrics,
                    // song_file参数是可选的，我们这里不提供参考音频文件
                }
            })
        }).catch(error => {
            // 捕获网络错误，特别是CORS错误
            if (error.message.includes('CORS') || error.message.includes('跨域') || error.message.includes('cross-origin')) {
                throw new Error('跨域请求被阻止。如果您是直接打开本地HTML文件，请尝试使用本地服务器运行应用。您可以使用README中提到的Python简易服务器方法。');
            }
            throw error;
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: '无法解析错误响应' }));
            throw new Error(`API请求失败: ${errorData.error || response.statusText}`);
        }

        const predictionData = await response.json();
        const predictionId = predictionData.id;

        // 2. 轮询检查预测结果
        return await pollPredictionResult(predictionId);
    } catch (error) {
        console.error('生成音乐时出错:', error);
        throw error;
    }
}

/**
 * 轮询检查预测结果
 * @param {string} predictionId - 预测ID
 * @returns {Promise} - 包含生成音乐URL的Promise
 */
async function pollPredictionResult(predictionId) {
    const maxAttempts = 60; // 最多尝试次数
    const pollInterval = 2000; // 轮询间隔（毫秒）
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
                headers: {
                    'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }).catch(error => {
                // 捕获网络错误，特别是CORS错误
                if (error.message.includes('CORS') || error.message.includes('跨域') || error.message.includes('cross-origin')) {
                    throw new Error('跨域请求被阻止。如果您是直接打开本地HTML文件，请尝试使用本地服务器运行应用。');
                }
                throw error;
            });

            if (!response.ok) {
                throw new Error(`轮询失败: ${response.statusText}`);
            }

            const result = await response.json();
            
            // 检查生成状态
            if (result.status === 'succeeded') {
                // 返回生成的音频URL
                return result.output;
            } else if (result.status === 'failed') {
                throw new Error(`音乐生成失败: ${result.error || '未知错误'}`);
            }
            
            // 如果还在处理中，等待一段时间后再次轮询
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (error) {
            console.error('轮询预测结果时出错:', error);
            throw error;
        }
    }
    
    throw new Error('生成音乐超时，请稍后重试');
}

// 导出API功能
window.MoodFlowAPI = {
    setApiToken,
    loadApiToken,
    isApiTokenSet,
    generateMusic,
    MOOD_PROMPTS,
    MOOD_NAMES
}; 