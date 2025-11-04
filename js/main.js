
document.addEventListener('DOMContentLoaded', () => {
  const debug = (...args) => { if (window.location.search.includes('dbg')) { } };


  const logo = document.getElementById('logo-img');
  if (logo) {
    logo.style.transition = 'transform 1400ms cubic-bezier(.2,.9,.3,1), opacity 1040ms ease';
    requestAnimationFrame(() => { logo.style.transform = 'translateX(0)'; logo.style.opacity = '1'; });
    setTimeout(()=> {
      logo.style.transition = 'transform 720ms cubic-bezier(.4,.0,.35,1)';
      logo.style.transform = 'translateX(6px)';
      setTimeout(()=> logo.style.transform = 'translateX(0)', 720);
    }, 1400);
  }


  const hero = document.querySelector('.hero-content');
  if (hero) {
    setTimeout(() => hero.classList.add('animate-in'), 90);
  }


  function revealOnScrollAll(selector, options = {root: null, rootMargin: '0px 0px -80px 0px', threshold: 0.08}) {
    const els = Array.from(document.querySelectorAll(selector));
    if (els.length === 0) return;
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');

          entry.target.querySelectorAll('video').forEach(v => {
            try { v.muted = true; v.loop = true; v.playsInline = true; v.play().catch(()=>{}); } catch(e){}
          });
          observer.unobserve(entry.target);
        }
      });
    }, options);

    els.forEach(el => {

      io.observe(el);
    });
  }


  revealOnScrollAll('.animate-from-right');
  revealOnScrollAll('.animate-from-left');


  (function ticker(){
    const slider = document.querySelector('.gif-slider');
    if (!slider) { debug('No .gif-slider found'); return; }
    const track = slider.querySelector('.gif-track');
    if (!track) { return; }

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
          v.play().catch(()=>{});
        } catch(e){  }
      });
    }

    function readGap(){
      const style = getComputedStyle(track);
      let g = parseFloat(style.gap || style.columnGap || 0);
      if (isNaN(g)) g = 0;
      return g;
    }

    function ensureScrollable(minExtra = 40, maxClones = 10){
      let clones = 0;
      if (track.children.length === 0) return false;
      while ((slider.scrollWidth <= slider.clientWidth + minExtra) && clones < maxClones) {
        const snapshot = Array.from(track.children).map(n => n.cloneNode(true));
        snapshot.forEach(n => track.appendChild(n));
        clones++;
        prepareVideos(track);
        if (clones > 0 && clones % 6 === 0 && slider.scrollWidth === slider.clientWidth) break;
      }
      debug('ensureScrollable result', { scrollWidth: slider.scrollWidth, clientWidth: slider.clientWidth, clones });
      return slider.scrollWidth > slider.clientWidth + minExtra;
    }

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
        slider.scrollLeft += px;
        const first = track.children[0];
        if (first) {
          const gap = readGap();
          const firstW = first.offsetWidth;
          const threshold = firstW + gap - 0.5;
          if (slider.scrollLeft >= threshold) {
            const shift = first.offsetWidth + gap;
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

    window.__lumixTicker = {
      setSpeed: v => { speedPxPerSec = Number(v) || speedPxPerSec; debug('setSpeed', speedPxPerSec); },
      pause: () => { stopLoop(); },
      resume: () => { startLoop(); }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    });

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          waitForMediaLoad(track).then(() => {
            prepareVideos(track);
            setTimeout(() => {
              const ok = ensureScrollable(40, 12);
              if (!ok) ensureScrollable(0, 20);
              slider.scrollLeft = 1;
              startLoop();
            }, 60);
          }).catch(err => {

            ensureScrollable(40, 12);
            slider.scrollLeft = 1;
            startLoop();
          });
        } else {
          stopLoop();
        }
      });
    }, { threshold: 0.1 });

    io.observe(slider);

    ['click','keydown','touchstart'].forEach(evt => {
      window.addEventListener(evt, () => track.querySelectorAll('video').forEach(v => v.play().catch(()=>{})), { once:true });
    });

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        ensureScrollable(40, 12);
      }, 160);
    });

    debug('ticker initialized (waiting for visibility)');
  })();


  const supportBtn = document.getElementById('open-support');
  const modal = document.getElementById('support-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalClose = document.getElementById('modal-close');
  const modalDone = document.getElementById('modal-done');
  const walletListEl = document.getElementById('wallet-list');


  const WALLETS = [
    { label: 'SOL', addr: '5MMwK6gmjewbmdNt9iibFpeoHRGkRXq7FXszBdAFMQs6' },
    { label: 'CARDANO', addr: 'addr1vx7qluz2gxcs5cw9nm6kec8a7ycr27z8evflr7cfehrm88grkeuth' },
    { label: 'ERC20/BEP20', addr: '0x18725dc47ddcb3da8cae11d1c08d8b76f22f3aa3' }
  ];

  function populateWallets(){
    if (!walletListEl) return;
    walletListEl.innerHTML = '';
    WALLETS.forEach((w, i) => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.innerHTML = `<strong>${escapeHtml(w.label)}</strong><div class="wallet-addr" title="${escapeHtml(w.addr)}">${escapeHtml(w.addr)}</div>`;
      const right = document.createElement('div');
      const copy = document.createElement('button');
      copy.className = 'copy-btn';
      copy.textContent = 'Copy';
      copy.addEventListener('click', () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(w.addr).then(() => {
            copy.textContent = 'Copied!';
            setTimeout(()=> copy.textContent = 'Copy', 1400);
          }).catch(()=> {
            promptCopy(w.addr, copy);
          });
        } else {
          promptCopy(w.addr, copy);
        }
      });
      right.appendChild(copy);
      li.appendChild(left);
      li.appendChild(right);
      walletListEl.appendChild(li);
    });
  }

  function promptCopy(addr, btn){
    try {
      prompt('Copy address (Ctrl+C / Cmd+C):', addr);
    } catch(e){  }
    if (btn) {
      btn.textContent = 'Copy';
      setTimeout(()=> btn.textContent = 'Copy', 1400);
    }
  }

  function openModal(){
    if (!modal) return;
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    populateWallets();
    setTimeout(()=> { if (modalClose) modalClose.focus(); }, 80);
  }
  function closeModal(){
    if (!modal) return;
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    if (supportBtn) supportBtn.focus();
  }

  if (supportBtn) supportBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalDone) modalDone.addEventListener('click', closeModal);

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      closeModal();
      closeNav();
    }
  });

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
  }

  // ------------------ NAV BURGER LOGIC ------------------
  const burger = document.getElementById('nav-burger');
  const mainNav = document.getElementById('main-nav');

  function openNav(){
    if (!mainNav || !burger) return;
    mainNav.classList.add('open');
    burger.classList.add('open');
    burger.setAttribute('aria-expanded','true');
    document.body.style.overflow = 'hidden';
    const firstLink = mainNav.querySelector('a');
    if (firstLink) firstLink.focus();
  }

  function closeNav(){
    if (!mainNav || !burger) return;
    mainNav.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded','false');
    document.body.style.overflow = '';
    burger.focus();
  }

  if (burger && mainNav) {
    burger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mainNav.classList.contains('open');
      if (isOpen) closeNav(); else openNav();
    });
    // close nav when clicking any link (mobile)
    mainNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (mainNav.classList.contains('open')) {
          setTimeout(closeNav, 120);
        }
      });
    });
    // click outside nav closes it
    document.addEventListener('click', (ev) => {
      if (!mainNav.classList.contains('open')) return;
      const within = mainNav.contains(ev.target) || burger.contains(ev.target);
      if (!within) closeNav();
    });
    // keyboard navigation: Tab trapping (light)
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Tab' && mainNav.classList.contains('open')) {
        const focusable = mainNav.querySelectorAll('a, button');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault(); last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault(); first.focus();
        }
      }
    });
  }

  debug('main.js loaded (with modal, ticker, and improved reveal-on-scroll).');
});

/* ===== LUMIX - Minimal override untuk masking address & copy (ADD ONLY) ===== */
(function(){
  try {
    // pastikan elemen ada
    const walletListEl = document.getElementById('wallet-list');
    if (!walletListEl) return;

    // kalau WALLETS sudah ada (script utama), gunakan itu, kalau tidak gunakan array fallback
    const sourceWallets = (typeof WALLETS !== 'undefined' && Array.isArray(WALLETS) && WALLETS.length) ? WALLETS : [
      { label: 'SOL', addr: '5MMwK6gmjewbmdNt9iibFpeoHRGkRXq7FXszBdAFMQs6' }
    ];

    function maskAddr(addr){
      if (!addr) return '';
      if (addr.length <= 12) return addr;
      const first = addr.slice(0,5);
      const last = addr.slice(-5);
      return first + 'xxxxxx' + last;
    }

    // override populateWallets jika ada (menimpa definisi sebelumnya)
    window.populateWallets = function(){
      walletListEl.innerHTML = '';
      sourceWallets.forEach((w) => {
        const li = document.createElement('li');
        // left side: label + masked address (masked visible, full in title)
        const left = document.createElement('div');
        left.innerHTML = `<strong>${escapeHtml(w.label)}</strong><div class="wallet-addr" title="${escapeHtml(w.addr)}">${escapeHtml(maskAddr(w.addr))}</div>`;

        // right side: copy button yang menyimpan alamat penuh
        const right = document.createElement('div');
        const copy = document.createElement('button');
        copy.className = 'copy-btn';
        copy.type = 'button';
        copy.textContent = 'Copy';
        copy.dataset.full = w.addr || '';

        copy.addEventListener('click', function(){
          const full = this.dataset.full || '';
          if (!full) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(full).then(() => {
              const prev = this.textContent;
              this.textContent = 'Copied!';
              setTimeout(()=> this.textContent = prev, 1400);
            }).catch(() => {
              // fallback prompt
              try { prompt('Copy address (Ctrl+C / Cmd+C):', full); } catch(e){}
            });
          } else {
            try { prompt('Copy address (Ctrl+C / Cmd+C):', full); } catch(e){}
          }
        });

        right.appendChild(copy);
        li.appendChild(left);
        li.appendChild(right);
        walletListEl.appendChild(li);
      });
    };

    // helper escape (cocok dengan fungsi di file asli)


    // Jika modal sudah dibuka sebelumnya, populate sekarang supaya perubahan terlihat langsung
    // (tapi tidak memaksa modal terbuka)
    if (document.getElementById('support-modal') && document.getElementById('support-modal').getAttribute('aria-hidden') === 'false') {
      window.populateWallets();
    }
  } catch (err) {

  }
})();

// --- Minimal addition: support modal masked addresses + copy full ---
(function(){
  const walletListEl = document.getElementById('wallet-list');
  if (!walletListEl) return;
  const supportBtn = document.getElementById('open-support');
  const modal = document.getElementById('support-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalClose = document.getElementById('modal-close');
  const modalDone = document.getElementById('modal-done');

  // Replace these addresses with real ones as needed (kept minimal)
  const WALLETS = [
    { label: 'SOL', addr: '5MMwK6gmjewbmdNt9iibFpeoHRGkRXq7FXszBdAFMQs6' },
    { label: 'ERC20', addr: '0x18725dc47ddcb3da8cae11d1c08d8b76f22f3aa3' }
  ];

  function maskAddr(addr){
    if (!addr) return '';
    if (addr.length <= 12) return addr;
    const first = addr.slice(0,5);
    const last = addr.slice(-5);
    return first + 'xxxx' + last;
  }

  function populate(){
    walletListEl.innerHTML = '';
    WALLETS.forEach(w => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.className = 'wallet-left';
      left.innerHTML = '<strong>' + w.label + '</strong><div class="wallet-addr" title="' + w.addr + '">' + maskAddr(w.addr) + '</div>';
      const right = document.createElement('div');
      right.className = 'wallet-right';
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.dataset.full = w.addr;
      btn.addEventListener('click', function(){
        const full = this.dataset.full || '';
        if (!full) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(full).then(() => {
            const prev = this.textContent;
            this.textContent = 'Copied!';
            setTimeout(()=> this.textContent = prev, 1200);
          }).catch(()=> { try { prompt('Copy address:', full); } catch(e){} });
        } else { try { prompt('Copy address:', full); } catch(e){} }
      });
      right.appendChild(btn);
      li.appendChild(left);
      li.appendChild(right);
      walletListEl.appendChild(li);
    });
  }

  function openModal(){
    if (!modal) return;
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    populate();
    setTimeout(()=> { if (modalClose) modalClose.focus(); }, 80);
  }
  function closeModal(){
    if (!modal) return;
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  if (supportBtn) supportBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalDone) modalDone.addEventListener('click', closeModal);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeModal(); });

})();

// Attach support modal opener for second bottom button (if present)
document.addEventListener('DOMContentLoaded', function(){
  var b2 = document.getElementById('open-support-2');
  if (b2) {
    b2.addEventListener('click', function(e){
      e.preventDefault();
      var primary = document.getElementById('open-support');
      if (primary) primary.click();
    });
  }
});
