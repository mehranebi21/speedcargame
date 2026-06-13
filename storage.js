const GameStorage = {
    getHighScore() {
        return parseInt(localStorage.getItem('game_top_score')) || 0;
    },
    saveHighScore(score) {
        if (score > this.getHighScore()) {
            localStorage.setItem('game_top_score', score);
        }
    },
    getCoins() {
        return parseInt(localStorage.getItem('game_total_coins')) || 0;
    },
    addCoins(amount) {
        localStorage.setItem('game_total_coins', this.getCoins() + amount);
    },
    deductCoins(amount) {
        let current = this.getCoins();
        if (current >= amount) {
            localStorage.setItem('game_total_coins', current - amount);
            return true;
        }
        return false;
    },
    isCarUnlocked(carId) {
        if (carId === 'red') return true;
        return localStorage.getItem(`car_status_${carId}`) === 'unlocked';
    },
    unlockCar(carId) {
        localStorage.setItem(`car_status_${carId}`, 'unlocked');
    }
};
