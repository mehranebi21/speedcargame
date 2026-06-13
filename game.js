const player = document.getElementById('player');
const road = document.getElementById('road');
const scoreVal = document.getElementById('score-val');
const levelVal = document.getElementById('level-val');
const coinsVal = document.getElementById('coins-val');
const startMenu = document.getElementById('start-menu');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const shopScreen = document.getElementById('shop-screen');

let gameState = 'MENU';
let score = 0, coins = 0, level = 1, speed = 5;
let isMuted = false;
let activeCarColor = '#e74c3c';
let playerX = 217;
const roadWidth = 480;
let gameInterval, spawnTimer = 0, roadLineTimer = 0;
let gameElements = [];

// تولید فرکانس صوتی بومی موتور مرورگر (بدون نیاز به فایل صوتی خارجی)
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    play(type) {
        if (isMuted) return;
        this.init();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        if (type === 'coin') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, this.ctx.currentTime); // نت E5
            osc.frequency.setValueAtTime(987.77, this.ctx.currentTime + 0.08); // نت B5
            gainNode.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.25);
        } else if (type === 'explosion') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.7);
            gainNode.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.7);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.7);
        }
    }
};

function initMenu() {
    document.getElementById('high-score-val').innerText = GameStorage.getHighScore();
    coins = GameStorage.getCoins();
    coinsVal.innerText = coins;
}
initMenu();

// هندلینگ دکمه‌های کنترلی لمسی و کیبورد
let keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

document.getElementById('btn-left').addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowLeft'] = true; });
document.getElementById('btn-left').addEventListener('touchend', () => keys['ArrowLeft'] = false);
document.getElementById('btn-right').addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowRight'] = true; });
document.getElementById('btn-right').addEventListener('touchend', () => keys['ArrowRight'] = false);

document.getElementById('btn-mute').addEventListener('click', () => {
    isMuted = !isMuted;
    document.getElementById('btn-mute').innerText = isMuted ? "صدا: خاموش" : "صدا: روشن";
});

document.getElementById('btn-pause-trigger').addEventListener('click', () => {
    if (gameState === 'PLAYING') { gameState = 'PAUSED'; pauseScreen.classList.remove('hidden'); }
});
document.getElementById('btn-resume').addEventListener('click', () => {
    gameState = 'PLAYING'; pauseScreen.classList.add('hidden');
});

document.getElementById('btn-start').addEventListener('click', () => { startMenu.classList.add('hidden'); startGame(); });
document.getElementById('btn-restart').addEventListener('click', () => { gameOverScreen.classList.add('hidden'); startGame(); });

function startGame() {
    score = 0; level = 1; speed = 5.5;
    coins = GameStorage.getCoins();
    playerX = 217;
    player.style.left = playerX + 'px';
    player.className = ''; 
    player.style.background = activeCarColor;
    
    // ریست کردن جاده
    gameElements.forEach(el => el.dom.remove());
    gameElements = [];
    document.querySelectorAll('.road-line').forEach(line => line.remove());
    
    gameState = 'PLAYING';
    clearInterval(gameInterval);
    gameInterval = setInterval(updateGame, 1000 / 60);
}

function updateGame() {
    if (gameState !== 'PLAYING') return;

    // جابجایی افقی ماشین بازیکن
    if (keys['ArrowLeft'] && playerX > 20) playerX -= 5.5;
    if (keys['ArrowRight'] && playerX < (roadWidth - 66)) playerX += 5.5;
    player.style.left = playerX + 'px';

    // مکانیزم افزایش سرعت و لول‌آپ بازی
    level = Math.floor(score / 500) + 1;
    speed = 5 + level * 1.3;
    levelVal.innerText = level;
    score++;
    scoreVal.innerText = score;

    // متحرک‌سازی خطوط سفید جاده
    roadLineTimer += speed;
    if (roadLineTimer > 60) {
        roadLineTimer = 0;
        let line = document.createElement('div');
        line.className = 'road-line';
        line.style.top = '-50px';
        road.appendChild(line);
        gameElements.push({ type: 'line', y: -50, dom: line });
    }

    // تولید موانع و سکه‌ها
    spawnTimer++;
    if (spawnTimer % 75 === 0) {
        let randX = Math.floor(Math.random() * (roadWidth - 80)) + 20;
        let type = Math.random() > 0.35 ? 'enemy' : 'coin';
        let element = document.createElement('div');
        element.className = type;
        element.style.left = randX + 'px';
        element.style.top = '-100px';
        road.appendChild(element);
        gameElements.push({ type: type, y: -100, dom: element });
    }

    // آپدیت موقعیت و بررسی برخورد فیزیکی اجسام
    for (let i = gameElements.length - 1; i >= 0; i--) {
        let item = gameElements[i];
        item.y += speed;
        item.dom.style.top = item.y + 'px';

        if (item.y > window.innerHeight) {
            item.dom.remove();
            gameElements.splice(i, 1);
            continue;
        }

        if (item.type === 'line') continue;

        let pRect = player.getBoundingClientRect();
        let iRect = item.dom.getBoundingClientRect();

        // بررسی الگوریتم برخورد مستطیلی AABB
        if (pRect.left < iRect.right && pRect.right > iRect.left &&
            pRect.top < iRect.bottom && pRect.bottom > iRect.top) {
            
            if (item.type === 'coin') {
                AudioEngine.play('coin');
                GameStorage.addCoins(1);
                coins++;
                coinsVal.innerText = coins;
                item.dom.remove();
                gameElements.splice(i, 1);
            } else if (item.type === 'enemy') {
                endGame();
            }
        }
    }
}

function endGame() {
    gameState = 'GAMEOVER';
    clearInterval(gameInterval);
    AudioEngine.play('explosion');
    
    player.classList.add('explosion-effect');
    GameStorage.saveHighScore(score);
    
    document.getElementById('final-score').innerText = score;
    setTimeout(() => { gameOverScreen.classList.remove('hidden'); }, 1000);
}

// کدهای بخش فروشگاه پوسته‌ها
document.getElementById('btn-shop-trigger').addEventListener('click', () => {
    shopScreen.classList.remove('hidden');
    document.getElementById('shop-coins-val').innerText = GameStorage.getCoins();
});
document.getElementById('btn-close-shop').addEventListener('click', () => { shopScreen.classList.add('hidden'); initMenu(); });

document.getElementById('btn-select-red').addEventListener('click', () => {
    activeCarColor = '#e74c3c';
    alert('ماشین مسابقه‌ای قرمز فعال شد.');
});

document.getElementById('btn-buy-yellow').addEventListener('click', () => {
    if (GameStorage.isCarUnlocked('yellow')) {
        activeCarColor = '#f1c40f';
        alert('ماشین اسپرت زرد انتخاب شد.');
    } else {
        if (GameStorage.deductCoins(50)) {
            GameStorage.unlockCar('yellow');
            activeCarColor = '#f1c40f';
            document.getElementById('shop-coins-val').innerText = GameStorage.getCoins();
            alert('خرید با موفقیت انجام شد و این پوسته آنلاک گردید!');
        } else {
            alert('سکه‌های شما کافی نیست! در طول بازی سکه جمع کنید.');
        }
    }
});
