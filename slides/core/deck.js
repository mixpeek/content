/* Minimal slide deck runtime with configurable slide list */
(function () {
    function listFromConfigOrParams() {
        // Priority: window.DECK_SLIDES (array of paths), then DECK_MAX_SLIDES / ?max, else 1..50
        if (Array.isArray(window.DECK_SLIDES) && window.DECK_SLIDES.length > 0) {
            return window.DECK_SLIDES.slice();
        }
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        const maxParam = params.get('max');
        const configured = window.DECK_MAX_SLIDES;
        const chosen = maxParam || configured;
        if (chosen) {
            const max = parseInt(chosen, 10);
            if (!Number.isNaN(max) && max > 0) {
                return Array.from({ length: max }, (_, i) => `${i + 1}.html`);
            }
        }
        return Array.from({ length: 50 }, (_, i) => `${i + 1}.html`);
    }

    function createDeck(slides) {
        const deck = document.createElement('div');
        deck.className = 'deck';

        const progress = document.createElement('div');
        progress.className = 'deck-progress';
        progress.textContent = `1 / ${slides.length}`;
        document.body.appendChild(progress);

        const slideElements = [];
        slides.forEach((slidePath) => {
            const wrapper = document.createElement('section');
            wrapper.className = 'deck-slide';
            const iframe = document.createElement('iframe');
            iframe.loading = 'eager';
            iframe.referrerPolicy = 'no-referrer';
            iframe.src = slidePath;
            iframe.addEventListener('error', () => {
                wrapper.style.display = 'none';
                updateProgress();
            });
            wrapper.appendChild(iframe);
            deck.appendChild(wrapper);
            slideElements.push(wrapper);
        });

        function updateProgress() {
            const index = getActiveIndex();
            const visibleCount = slideElements.filter(el => el.style.display !== 'none').length || slides.length;
            progress.textContent = `${index + 1} / ${visibleCount}`;
        }
        function getActiveIndex() {
            const y = deck.scrollTop;
            const h = window.innerHeight || 1;
            const idx = Math.round(y / h);
            return Math.max(0, Math.min(slideElements.length - 1, idx));
        }
        let isSnapping = false;
        function snapTo(index) {
            index = Math.max(0, Math.min(slideElements.length - 1, index));
            isSnapping = true;
            deck.scrollTo({ top: index * window.innerHeight, behavior: 'auto' });
            setTimeout(() => { isSnapping = false; updateProgress(); }, 0);
        }
        // Keyboard navigation
        window.addEventListener('keydown', (e) => {
            const key = e.key;
            if (['ArrowDown', 'PageDown', ' ', 'Enter', 'ArrowRight'].includes(key)) {
                e.preventDefault();
                snapTo(getActiveIndex() + 1);
            } else if (['ArrowUp', 'PageUp', 'Backspace', 'ArrowLeft'].includes(key)) {
                e.preventDefault();
                snapTo(getActiveIndex() - 1);
            } else if (key === 'Home') {
                e.preventDefault();
                snapTo(0);
            } else if (key === 'End') {
                e.preventDefault();
                snapTo(slideElements.length - 1);
            }
        });
        // Wheel navigation
        let wheelLock = false;
        deck.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            if (wheelLock || isSnapping) return;
            wheelLock = true;
            const dir = e.deltaY > 0 ? 1 : -1;
            snapTo(getActiveIndex() + dir);
            setTimeout(() => { wheelLock = false; }, 120);
        }, { passive: false });
        // Resize snap
        window.addEventListener('resize', () => {
            snapTo(getActiveIndex());
        });
        // Scroll progress debounce
        let scrollTimeout = null;
        deck.addEventListener('scroll', () => {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(updateProgress, 80);
        });

        document.body.innerHTML = '';
        document.body.appendChild(deck);
        document.body.appendChild(progress);
        const hash = window.location.hash.replace('#', '').trim();
        if (hash && /^\d+$/.test(hash)) {
            snapTo(parseInt(hash, 10) - 1);
        } else {
            snapTo(0);
        }
        return { deck, snapTo, getActiveIndex };
    }

    function start() {
        const slides = listFromConfigOrParams();
        createDeck(slides);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();


