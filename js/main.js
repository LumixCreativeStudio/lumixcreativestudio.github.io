// main.js — Robust marquee ticker v3
// Improvements:
// - Uses IntersectionObserver to only run when visible
// - Does NOT pause on hover (per request) so ticker always moves
// - Safety: limits clones, pauses on document.hidden, debug via ?dbg=1

document.addEventListener('DOMContentLoaded', () => {
  const debug = (...args) => { if (window.location.search.includes('dbg')) console.log('[ticker]', ...args); };

  // Small UI tweaks (logo/hero)
  const logo = document.getElementById('logo-img');
  if (logo) {
    logo.style.transition = 'transform 700ms cubic-bezier(.2,.9,.3,1), opacity 520ms ease';
    requestAnimationFrame(() => { logo.style.transform = 'translateX(0)'; logo.style.opacity = '1'; });
    setTimeout(()=>{ logo.style.transition='transform 360ms cubic-bezier(.4,.0,.35,1)'; logo.style.transform='translateX(6px)'; setTimeout(()=>logo.style.transform='translateX(0)',360); },700);
  }
  const hero = document.querySelector('.hero-content');
  if (hero) requestAnimationFrame(()=> hero.classList.add('animate-in'));

  function revealOnScroll(sel){ const el=document.querySelector(sel); if(!el) return; const onScroll=()=>{ const r=el.getBoundingClientRect(); if(r.top < (window.innerHeight-100)){ el.classList.add('in'); window.removeEventListener('scroll', onScroll); } }; onScroll(); window.addEventListener('scroll', onScroll); }
  revealOnScroll('.animate-from-right'); revealOnScroll('.animate-from-left');

  (function ticker(){
    const slider = document.querySelector('.gif-slider');
    if (!slider) { debug('No .gif-slider found'); return; }
    const track = slider.querySelector('.gif-track');
    if (!track) { console.warn('No .gif-track inside .gif-slider — ensure HTML has .gif-track'); return; }

    // helper: wait for media readiness
    function waitForMediaLoad(container){
      const imgs = Array.from(container.querySelectorAll('img'));
      const vids = Array.from(container.querySelectorAll('video'));
      const imgPromises = imgs.map(img => new Promise(res => {
        if (img.complete && img.naturalWidth) return res();
        img.addEventListener('load', ()=>res(), { once:true });
        img.addEventListener('error', ()=>res(), { once:true });
      }));
      const vidPromises = vids.map(v => new Promise(res => {
        if (v.readyState >= 1) return res();
        v.addEventListener('loadedmetadata', ()=>res(), { once:true });
        v.addEventListener('error', ()=>res(), { once:true });
      }));
      const timeout = new Promise(res => setTimeout(res, 1200));
      return Promise.race([ Promise.all([...imgPromises, ...vidPromises]), timeout ]);
    }

    function prepareVideos(container){
      container.querySelectorAll('video').forEach(v => {
        try {
          v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
          v.setAttribute('muted',''); v.setAttribute('loop',''); v.setAttribute('playsinline','');
          v.play().catch(()=>{ /* autoplay may be blocked until gesture */ });
        } catch(e){ /* ignore */ }
      });
    }

    // compute gap reading
    function readGap(){
      const style = getComputedStyle(track);
      let g = parseFloat(style.gap || style.columnGap || 0);
      if (isNaN(g)) g = 0;
      return g;
    }

    // ensure enough content exists so that scrollWidth > clientWidth
    function ensureScrollable(minExtra = 40, maxClones = 10){
      let clones = 0;
      if (track.children.length === 0) return false;
      while ((slider.scrollWidth <= slider.clientWidth + minExtra) && clones < maxClones) {
        const snapshot = Array.from(track.children).map(n => n.cloneNode(true));
        snapshot.forEach(n => track.appendChild(n));
        clones++;
        prepareVideos(track);
        // safety break if still zero growth
        if (clones > 0 && clones % 4 === 0 && slider.scrollWidth === slider.clientWidth) break;
      }
      debug('ensureScrollable result', { scrollWidth: slider.scrollWidth, clientWidth: slider.clientWidth, clones });
      return slider.scrollWidth > slider.clientWidth + minExtra;
    }

    // main runner
    let rafId = null;
    let running = false;
    let speedPxPerSec = 80;
    let last = performance.now();

    function startLoop(){
      if (running) return;
      running = true;
      last = performance.now();
      function loop(now){
        if (!running) return;
        const dt = now - last;
        last = now;
        const px = (speedPxPerSec * dt) / 1000;
        // move scroll
        slider.scrollLeft += px;
        // recycle fully scrolled-out items
        const first = track.children[0];
        if (first) {
          const gap = readGap();
          const firstW = first.offsetWidth;
          const threshold = firstW + gap - 0.5;
          if (slider.scrollLeft >= threshold) {
            const shift = first.offsetWidth + gap;
            // move first to end
            track.appendChild(first);
            slider.scrollLeft -= shift;
            debug('recycled one', { shift, scrollLeft: slider.scrollLeft });
          }
        }
        rafId = requestAnimationFrame(loop);
      }
      rafId = requestAnimationFrame(loop);
      debug('ticker: started (speedPxPerSec=' + speedPxPerSec + ')');
    }

    function stopLoop(){
      if (!running) return;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      debug('ticker: stopped');
    }

    // Expose controls
    window.__lumixTicker = {
      setSpeed: v => { speedPxPerSec = Number(v) || speedPxPerSec; debug('setSpeed', speedPxPerSec); },
      pause: () => { stopLoop(); },
      resume: () => { startLoop(); }
    };

    // Avoid hover/focus pauses per user request: (so do not add mouseenter/mouseleave)
    // But allow focus-based pause via explicit API if needed.

    // Pause when tab not visible (saves CPU)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    });

    // observe visibility of slider: only init when visible
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // when visible, prepare and start ticker
          waitForMediaLoad(track).then(() => {
            prepareVideos(track);
            setTimeout(() => {
              const ok = ensureScrollable(40, 12);
              if (!ok) ensureScrollable(0, 20);
              // small nudge to kick rendering in some browsers
              slider.scrollLeft = 1;
              startLoop();
            }, 60);
          }).catch(err => {
            console.warn('media wait failed (fallback start)', err);
            ensureScrollable(40, 12);
            slider.scrollLeft = 1;
            startLoop();
          });
        } else {
          // if slider out of view, stop to save CPU
          stopLoop();
        }
      });
    }, { threshold: 0.1 });

    io.observe(slider);

    // Ensure videos attempt to play on first gesture
    ['click','keydown','touchstart'].forEach(evt => {
      window.addEventListener(evt, () => track.querySelectorAll('video').forEach(v => v.play().catch(()=>{})), { once:true });
    });

    // on resize try to ensure scrollable content exists
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        ensureScrollable(40, 12);
      }, 160);
    });

    // safety: if user wants debug: window.location.search += '?dbg=1'
    debug('ticker initialized (waiting for visibility)');
  })();
});
