document.addEventListener('DOMContentLoaded', () => {
    // Torch effect mouse tracking (Throttled for performance)
    let ticking = false;
    document.addEventListener('mousemove', (e) => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                document.documentElement.style.setProperty('--cursor-x', e.clientX + 'px');
                document.documentElement.style.setProperty('--cursor-y', e.clientY + 'px');
                ticking = false;
            });
            ticking = true;
        }
    });

    const form = document.getElementById('doom-form');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    const resetBtn = document.getElementById('reset-btn');

    // REC Time
    const recTime = document.getElementById('rec-time');
    let recSeconds = 0;
    setInterval(() => {
        recSeconds++;
        const hrs = Math.floor(recSeconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((recSeconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (recSeconds % 60).toString().padStart(2, '0');
        if (recTime) recTime.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);

    let elapsedInterval;

    // Start BGM on first user interaction (browser autoplay policy)
    const bgm = document.getElementById('bgm');
    document.body.addEventListener('click', () => {
        if (bgm && bgm.paused) {
            bgm.volume = 0.5; // Set volume to 50%
            bgm.play().catch(e => console.log('Audio play blocked:', e));
        }
    }, { once: true });

    // Button click sound effect
    const playButtonSound = () => {
        const btnSound = new Audio('button.mp3');
        btnSound.volume = 0.8;
        btnSound.play().catch(e => console.log('Button sound blocked:', e));
    };

    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', playButtonSound);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const birthDate = document.getElementById('birthDate').value;
        const birthTime = document.getElementById('birthTime').value;

        if (!birthDate) return;

        // UI State update
        form.classList.add('hidden');
        loading.classList.remove('hidden');
        result.classList.add('hidden');

        try {
            const response = await fetch('/api/doom-date', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ birthDate, birthTime })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch doom.');
            }

            // Populate results
            document.getElementById('score-value').textContent = data.doomScore;
            document.getElementById('event-year').textContent = data.event.year;
            
            const descEl = document.getElementById('event-description');
            const wastedOverlay = document.getElementById('wasted-overlay');
            
            descEl.textContent = data.event.event;
            
            if (data.event.isFallback) {
                document.getElementById('wasted-text').textContent = data.event.event;
                wastedOverlay.classList.remove('hidden');
                
                // Trigger explosion effects
                const explosionSound = new Audio('explosion.mp3');
                explosionSound.volume = 1.0;
                explosionSound.play().catch(e => console.log('Explosion sound blocked:', e));
                
                const containerEl = document.querySelector('.container');
                const cameraEl = document.querySelector('.camera-ui');
                if (containerEl) containerEl.classList.add('screen-shake');
                if (cameraEl) cameraEl.classList.add('screen-shake');
                
                setTimeout(() => {
                    if (containerEl) containerEl.classList.remove('screen-shake');
                    if (cameraEl) cameraEl.classList.remove('screen-shake');
                }, 800);
            } else {
                wastedOverlay.classList.add('hidden');
                descEl.classList.remove('fallback-horror');
            }
            
            document.getElementById('warning-message').textContent = data.warningMessage;

            const imgEl = document.getElementById('event-image');
            if (imgEl) {
                if (data.event.imageUrl) {
                    imgEl.src = data.event.imageUrl;
                    imgEl.classList.remove('hidden');
                } else {
                    imgEl.classList.add('hidden');
                }
            }

            const linkEl = document.getElementById('event-link');
            if (data.event.links) {
                linkEl.href = data.event.links;
                linkEl.classList.remove('hidden');
            } else {
                linkEl.classList.add('hidden');
            }

            // Show results
            loading.classList.add('hidden');
            result.classList.remove('hidden');
            
            // Disable torch effect on results screen
            const torchEl = document.getElementById('torch');
            if (torchEl) torchEl.classList.add('hidden');
            
            // Start elapsed timer
            const eventDate = new Date(birthDate);
            const timerContainer = document.getElementById('elapsed-timer-container');
            const timeEl = document.getElementById('elapsed-time');
            
            if (elapsedInterval) clearInterval(elapsedInterval);
            timerContainer.classList.remove('hidden');
            
            // update once immediately
            const updateTimer = () => {
                const now = new Date();
                const diff = now - eventDate;
                if (diff < 0) {
                    timeEl.textContent = "00:00:00:00";
                    return;
                }
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
                const mins = Math.floor((diff / (1000 * 60)) % 60).toString().padStart(2, '0');
                const secs = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
                timeEl.textContent = `${days} Days, ${hours}:${mins}:${secs}`;
            };
            
            updateTimer();
            elapsedInterval = setInterval(updateTimer, 1000);

        } catch (error) {
            console.error('Error:', error);
            alert('A cosmic error occurred. Try again.');
            loading.classList.add('hidden');
            form.classList.remove('hidden');
        }
    });

    const resetState = () => {
        result.classList.add('hidden');
        form.classList.remove('hidden');
        
        const torchEl = document.getElementById('torch');
        if (torchEl) torchEl.classList.remove('hidden');
        
        document.getElementById('birthDate').value = '';
        document.getElementById('birthTime').value = '';
        if (elapsedInterval) clearInterval(elapsedInterval);
        document.getElementById('elapsed-timer-container').classList.add('hidden');
    };

    resetBtn.addEventListener('click', resetState);
    
    const wastedOverlayEl = document.getElementById('wasted-overlay');
    if (wastedOverlayEl) {
        wastedOverlayEl.addEventListener('click', () => {
            wastedOverlayEl.classList.add('hidden');
            resetState();
        });
    }
});
