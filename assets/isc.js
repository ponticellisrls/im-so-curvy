/* I'M So Curvy — script del tema */

/* Aggiunta al carrello senza lasciare la pagina ("Completa il look", carosello prodotti) */
async function iscAddToCart(variantId, button) {
  const cartDrawer = document.querySelector('cart-drawer');
  const body = { items: [{ id: Number(variantId), quantity: 1 }] };
  if (cartDrawer && typeof cartDrawer.getSectionsToRender === 'function') {
    body.sections = cartDrawer.getSectionsToRender().map((section) => section.id);
    body.sections_url = window.location.pathname;
  }

  const response = await fetch(`${window.routes.cart_add_url}.js`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const state = await response.json();
  if (!response.ok || state.status) throw new Error(state.description || 'add failed');

  if (cartDrawer && state.sections) {
    cartDrawer.classList.remove('is-empty');
    cartDrawer.renderContents(state);
  } else {
    window.location.href = window.routes.cart_url;
  }
  return state;
}

document.addEventListener('click', async (event) => {
  /* apri / chiudi la scelta taglie della scheda prodotto */
  const openSizes = event.target.closest('[data-isc-sizes-open]');
  if (openSizes) {
    const card = openSizes.closest('[data-isc-pcard]');
    const panel = card && card.querySelector('[data-isc-sizes]');
    if (panel) {
      document.querySelectorAll('[data-isc-sizes]:not([hidden])').forEach((p) => {
        if (p !== panel) p.hidden = true;
      });
      panel.hidden = !panel.hidden;
      openSizes.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) panel.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    }
    return;
  }

  const closeSizes = event.target.closest('[data-isc-sizes-close]');
  if (closeSizes) {
    const panel = closeSizes.closest('[data-isc-sizes]');
    panel.hidden = true;
    panel.closest('[data-isc-pcard]')?.querySelector('[data-isc-sizes-open]')?.setAttribute('aria-expanded', 'false');
    return;
  }

  /* suggerimenti nel carrello: aggiungi la taglia scelta nel menu a tendina */
  const pickBtn = event.target.closest('[data-isc-add-select]');
  if (pickBtn) {
    const select = pickBtn.parentElement.querySelector('select');
    if (!select || !select.value) return;
    pickBtn.disabled = true;
    pickBtn.classList.add('is-loading');
    try {
      await iscAddToCart(select.value, pickBtn);
    } catch (error) {
      console.error(error);
      pickBtn.disabled = false;
      pickBtn.classList.remove('is-loading');
    }
    return;
  }

  /* aggiungi al carrello */
  const button = event.target.closest('[data-isc-add], [data-isc-upsell-add]');
  if (!button || button.disabled) return;
  event.preventDefault();

  const variantId = button.dataset.iscAdd || button.dataset.iscUpsellAdd;
  const labels = button.querySelectorAll('span').length ? [...button.querySelectorAll('span')] : [button];
  const originals = labels.map((el) => el.textContent);
  const setLabel = (text) => labels.forEach((el) => (el.textContent = text));
  const restore = () => labels.forEach((el, i) => (el.textContent = originals[i]));
  button.disabled = true;
  button.classList.add('is-loading');

  try {
    await iscAddToCart(variantId, button);
    button.classList.remove('is-loading');
    button.classList.add('is-added');

    const panel = button.closest('[data-isc-sizes]');
    if (panel) {
      /* scelta taglia: chiudi il pannello e conferma sul pulsante della scheda */
      button.disabled = false;
      button.classList.remove('is-added');
      panel.hidden = true;
      const spans = [...(panel.closest('[data-isc-pcard]')?.querySelectorAll('[data-isc-sizes-open] span') || [])];
      const texts = spans.map((el) => el.textContent);
      spans.forEach((el) => (el.textContent = 'Aggiunto ✓'));
      setTimeout(() => spans.forEach((el, i) => (el.textContent = texts[i])), 2200);
    } else if (button.hasAttribute('data-isc-upsell-add')) {
      setLabel('Aggiunto');
    } else {
      setLabel('Aggiunto ✓');
      setTimeout(() => {
        restore();
        button.disabled = false;
        button.classList.remove('is-added');
      }, 2200);
    }
  } catch (error) {
    console.error(error);
    button.disabled = false;
    button.classList.remove('is-loading');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('[data-isc-sizes]:not([hidden])').forEach((p) => (p.hidden = true));
});

/* Carosello orizzontale con frecce */
if (!customElements.get('isc-carousel')) {
  customElements.define(
    'isc-carousel',
    class extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('.isc-pc__track');
        this.prev = this.querySelector('.isc-pc__arrow--prev');
        this.next = this.querySelector('.isc-pc__arrow--next');
        if (!this.track) return;
        const step = () => {
          const slide = this.track.querySelector('.isc-pc__slide');
          const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
          const per = slide ? slide.getBoundingClientRect().width + gap : this.track.clientWidth;
          return Math.max(per, Math.floor(this.track.clientWidth / per) * per);
        };
        this.prev.addEventListener('click', () => this.track.scrollBy({ left: -step(), behavior: 'smooth' }));
        this.next.addEventListener('click', () => this.track.scrollBy({ left: step(), behavior: 'smooth' }));
        this.update = this.update.bind(this);
        this.track.addEventListener('scroll', this.update, { passive: true });
        this.ro = new ResizeObserver(this.update);
        this.ro.observe(this.track);
        this.update();
      }
      disconnectedCallback() {
        this.ro && this.ro.disconnect();
      }
      update() {
        const max = this.track.scrollWidth - this.track.clientWidth;
        const overflow = max > 4;
        this.prev.hidden = !overflow || this.track.scrollLeft <= 4;
        this.next.hidden = !overflow || this.track.scrollLeft >= max - 4;
      }
    }
  );
}

/* ------------------------------------------------------------------ */
/* Popup (newsletter e promo): apertura automatica condivisa           */
/* ------------------------------------------------------------------ */
window.IscPopups = window.IscPopups || {
  openCount: 0,

  /* può aprirsi da solo? (attivo, date, dispositivo, già chiuso, già iscritto) */
  canAutoOpen(el) {
    const d = el.dataset;
    if (d.auto !== 'true') return false;
    if (window.Shopify && window.Shopify.designMode) return false;
    if (d.subscribed === 'true') return false;
    if (d.pageOk === 'false') return false;
    const mobile = window.matchMedia('(max-width: 749px)').matches;
    if (mobile && d.mobile === 'false') return false;
    if (!mobile && d.desktop === 'false') return false;
    const now = Date.now();
    const start = d.start ? Date.parse(d.start.replace(' ', 'T')) : NaN;
    const end = d.end ? Date.parse(d.end.replace(' ', 'T')) : NaN;
    if (!isNaN(start) && now < start) return false;
    if (!isNaN(end) && now > end) return false;
    try {
      if (Number(localStorage.getItem(d.key) || 0) > now) return false;
    } catch (e) {}
    return true;
  },

  /* programma l'apertura: dopo X secondi, dopo X% di scroll, o quando si sta per uscire */
  schedule(el, open) {
    if (!this.canAutoOpen(el)) return;
    const d = el.dataset;
    let done = false;
    const fire = () => {
      if (done) return;
      /* un popup alla volta: se ne è già aperto uno, riprova tra poco */
      if (this.openCount > 0) return setTimeout(fire, 4000);
      done = true;
      cleanup();
      open();
    };
    const delay = Math.max(0, parseInt(d.delay, 10) || 0) * 1000;
    const pct = Math.min(100, Math.max(1, parseInt(d.scroll, 10) || 40)) / 100;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0 || window.scrollY / max >= pct) fire();
    };
    const onLeave = (e) => { if (e.clientY <= 0) fire(); };
    const cleanup = () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onLeave);
    };
    if (d.trigger === 'scroll') {
      window.addEventListener('scroll', onScroll, { passive: true });
    } else if (d.trigger === 'exit') {
      const touch = window.matchMedia('(hover: none)').matches;
      /* su mobile non esiste "uscita": dopo il ritardo impostato */
      if (touch) setTimeout(fire, delay || 15000);
      else document.addEventListener('mouseout', onLeave);
    } else {
      setTimeout(fire, delay);
    }
  },

  remember(el, days) {
    const d = el.dataset;
    const n = days != null ? days : parseInt(d.days, 10);
    try {
      if (n > 0) localStorage.setItem(d.key, String(Date.now() + n * 864e5));
    } catch (e) {}
  },
};

/* Popup promo (immagine 1:1) */
if (!customElements.get('isc-promo-popup')) {
  customElements.define(
    'isc-promo-popup',
    class extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('dialog');
        if (!this.dialog) return;
        this.querySelectorAll('[data-isc-popup-close]').forEach((b) => b.addEventListener('click', () => this.close()));
        this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.close(); });
        this.dialog.addEventListener('cancel', () => this.afterClose());
        this.querySelector('[data-isc-popup-link]')?.addEventListener('click', () => IscPopups.remember(this));

        /* link che aprono questo popup: href="#promo-popup" */
        document.addEventListener('click', (e) => {
          if (!e.target.closest('a[href$="#promo-popup"]')) return;
          e.preventDefault();
          this.open();
        });

        IscPopups.schedule(this, () => this.open());
        document.addEventListener('shopify:section:select', (e) => { if (this.closest('.shopify-section')?.id.endsWith(e.detail.sectionId)) this.open(); });
        document.addEventListener('shopify:section:deselect', () => this.dialog.open && this.dialog.close());
      }
      open() {
        if (this.dialog.open) return;
        this.dialog.showModal();
        IscPopups.openCount++;
        document.body.classList.add('overflow-hidden');
      }
      close() {
        this.dialog.close();
        this.afterClose();
      }
      afterClose() {
        IscPopups.openCount = Math.max(0, IscPopups.openCount - 1);
        document.body.classList.remove('overflow-hidden');
        IscPopups.remember(this);
      }
    }
  );
}

/* Popup newsletter */
if (!customElements.get('isc-newsletter-popup')) {
  customElements.define(
    'isc-newsletter-popup',
    class extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('dialog');
        this.querySelectorAll('[data-isc-nlp-close]').forEach((b) => b.addEventListener('click', () => this.close()));
        this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.close(); });
        this.dialog.addEventListener('cancel', () => this.afterClose());
        this.querySelector('[data-isc-copy]')?.addEventListener('click', (e) => {
          navigator.clipboard?.writeText(e.currentTarget.dataset.iscCopy);
          e.currentTarget.textContent = 'Copiato ✓';
        });

        /* link che aprono il popup: href="#newsletter-popup" oppure data-isc-newsletter-open */
        document.addEventListener('click', (e) => {
          if (!e.target.closest('a[href$="#newsletter-popup"], [data-isc-newsletter-open]')) return;
          e.preventDefault();
          this.open();
        });

        /* dopo l'invio la pagina si ricarica: riapri per mostrare conferma o errore */
        if (this.querySelector('[data-isc-nlp-success], [data-isc-nlp-error]')) {
          this.open();
          if (this.querySelector('[data-isc-nlp-success]')) IscPopups.remember(this, 3650);
          return;
        }

        IscPopups.schedule(this, () => this.open());
        document.addEventListener('shopify:section:select', (e) => { if (this.closest('.shopify-section')?.id.endsWith(e.detail.sectionId)) this.open(); });
        document.addEventListener('shopify:section:deselect', () => this.dialog.open && this.dialog.close());
      }
      open() {
        if (this.dialog.open) return;
        this.dialog.showModal();
        IscPopups.openCount++;
        document.body.classList.add('overflow-hidden');
      }
      close() {
        this.dialog.close();
        this.afterClose();
      }
      afterClose() {
        IscPopups.openCount = Math.max(0, IscPopups.openCount - 1);
        document.body.classList.remove('overflow-hidden');
        IscPopups.remember(this);
      }
    }
  );
}

/* ---------- Pagina prodotto: guida alle taglie ---------- */
if (!customElements.get('isc-size-guide')) {
  customElements.define(
    'isc-size-guide',
    class IscSizeGuide extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('dialog');
        this.onOpen = (e) => {
          if (!e.target.closest('[data-isc-size-open]')) return;
          e.preventDefault();
          this.dialog.showModal();
          document.body.classList.add('overflow-hidden');
        };
        /* il pulsante sta nel selettore varianti, che Dawn ridisegna a ogni cambio taglia */
        document.addEventListener('click', this.onOpen);
        this.dialog.addEventListener('click', (e) => {
          if (e.target === this.dialog || e.target.closest('[data-isc-size-close]')) this.dialog.close();
        });
        this.dialog.addEventListener('close', () => document.body.classList.remove('overflow-hidden'));
      }
      disconnectedCallback() { document.removeEventListener('click', this.onOpen); }
    }
  );
}

/* ---------- Pagina prodotto: barra "Aggiungi" fissa su mobile ---------- */
if (!customElements.get('isc-sticky-atc')) {
  customElements.define(
    'isc-sticky-atc',
    class IscStickyAtc extends HTMLElement {
      connectedCallback() {
        const id = this.dataset.section;
        this.info = document.getElementById(`MainProduct-${id}`);
        this.btn = this.querySelector('[data-isc-satc-add]');
        this.priceEl = this.querySelector('[data-isc-satc-price]');
        this.variantEl = this.querySelector('[data-isc-satc-variant]');
        this.target = () => document.getElementById(`ProductSubmitButton-${id}`);

        /* visibile solo quando il pulsante principale è fuori schermo (sopra o sotto) */
        const watch = this.target()?.closest('.product-form') || this.target();
        if (watch && 'IntersectionObserver' in window) {
          this.io = new IntersectionObserver(([entry]) => {
            const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
            this.classList.toggle('is-visible', show);
            this.setAttribute('aria-hidden', show ? 'false' : 'true');
            this.btn.tabIndex = show ? 0 : -1;
          });
          this.io.observe(watch);
        }

        this.btn.addEventListener('click', () => {
          const main = this.target();
          if (!main) return;
          if (main.disabled) {
            (document.querySelector(`#variant-selects-${id}`) || main).scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
          main.click();
        });

        /* prezzo, taglia e disponibilità seguono la variante scelta */
        const setText = (el, t) => { if (el && t && el.textContent !== t) el.textContent = t; };
        this.sync = () => {
          const box = this.info?.querySelector(`#price-${id} .price`);
          const sale = box?.classList.contains('price--on-sale');
          const price = box?.querySelector(sale ? '.price__sale .price-item--sale' : '.price__regular .price-item--regular');
          setText(this.priceEl, price?.textContent.trim());
          if (this.priceEl.classList.contains('is-sale') !== !!sale) this.priceEl.classList.toggle('is-sale', !!sale);
          const size = this.info?.querySelector('fieldset[data-option="taglia"] input:checked, fieldset[data-option="numero"] input:checked, fieldset[data-option="size"] input:checked');
          if (size) setText(this.variantEl, `Taglia ${size.value}`);
          const main = this.target();
          if (main) {
            setText(this.btn, main.disabled ? 'Esaurito' : 'Aggiungi');
            if (this.btn.classList.contains('is-soldout') !== main.disabled) this.btn.classList.toggle('is-soldout', main.disabled);
          }
        };
        if (this.info) {
          let queued = false;
          this.mo = new MutationObserver((list) => {
            if (list.every((m) => this.contains(m.target) || m.target.closest?.('.isc-delivery'))) return;
            if (queued) return;
            queued = true;
            setTimeout(() => { queued = false; this.sync(); }, 60);
          });
          this.mo.observe(this.info, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'] });
        }
        this.sync();
      }
      disconnectedCallback() {
        this.io?.disconnect();
        this.mo?.disconnect();
      }
    }
  );
}

/* ---------- Pagina prodotto: galleria a schermo intero con zoom ---------- */
if (!customElements.get('isc-lightbox')) {
  customElements.define(
    'isc-lightbox',
    class IscLightbox extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('dialog');
        this.track = this.querySelector('[data-isc-lb-track]');
        this.slides = [...this.querySelectorAll('.isc-lb__slide')];
        this.current = this.querySelector('[data-isc-lb-current]');
        this.hint = this.querySelector('[data-isc-lb-hint]');
        /* desktop: ingrandimento moderato; telefono: zoom nativo con due dita (niente zoom al tocco) */
        this.scale = 1.8;
        this.touch = window.matchMedia('(pointer: coarse)').matches;
        if (this.hint) this.hint.textContent = this.touch ? 'Allarga con due dita per ingrandire' : 'Clicca per ingrandire';

        /* intercetta il clic sulle foto prima di Dawn (che apriva un riquadro tagliato) */
        const gallery = document.getElementById(`MediaGallery-${this.dataset.section}`);
        this.onGalleryClick = (e) => {
          const opener = e.target.closest('.product__media-toggle, .product__modal-opener');
          if (!opener || !gallery?.contains(opener)) return;
          const holder = opener.closest('[data-media-id]') || opener;
          const id = String(holder.dataset.mediaId || opener.dataset.mediaId || '').split('-').pop();
          const index = Math.max(0, this.slides.findIndex((s) => s.dataset.mediaId === id));
          e.preventDefault();
          e.stopImmediatePropagation();
          this.open(index);
        };
        document.addEventListener('click', this.onGalleryClick, true);

        this.querySelector('[data-isc-lb-close]').addEventListener('click', () => this.dialog.close());
        this.querySelector('[data-isc-lb-prev]')?.addEventListener('click', () => this.go(this.index - 1));
        this.querySelector('[data-isc-lb-next]')?.addEventListener('click', () => this.go(this.index + 1));
        this.dialog.addEventListener('close', () => {
          this.resetZoom();
          document.body.classList.remove('overflow-hidden');
        });
        this.dialog.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight') this.go(this.index + 1);
          if (e.key === 'ArrowLeft') this.go(this.index - 1);
        });
        this.track.addEventListener('scroll', () => {
          const i = Math.round(this.track.scrollLeft / this.track.clientWidth);
          if (i !== this.index) {
            this.resetZoom();
            this.index = i;
            this.current.textContent = i + 1;
          }
        }, { passive: true });

        this.slides.forEach((slide) => this.bindZoom(slide.querySelector('[data-isc-lb-zoom]')));
      }

      disconnectedCallback() { document.removeEventListener('click', this.onGalleryClick, true); }

      open(index) {
        this.slides.forEach((s) => s.querySelector('img')?.setAttribute('loading', 'eager'));
        this.dialog.showModal();
        document.body.classList.add('overflow-hidden');
        this.go(index, 'instant');
      }

      go(i, behavior = 'smooth') {
        const n = this.slides.length;
        this.index = (i + n) % n;
        this.resetZoom();
        this.track.scrollTo({ left: this.index * this.track.clientWidth, behavior });
        this.current.textContent = this.index + 1;
      }

      resetZoom() {
        this.querySelectorAll('.is-zoomed').forEach((z) => {
          z.classList.remove('is-zoomed');
          z.style.transform = '';
        });
        this.track.classList.remove('is-locked');
      }

      /* tocco/clic = zoom massimo nel punto scelto; trascina per spostarti; altro tocco = torna normale */
      bindZoom(zoom) {
        let start = null;
        let moved = false;
        let pos = { x: 0, y: 0 };
        const limits = () => {
          const r = zoom.parentElement.getBoundingClientRect();
          return { x: (r.width * (this.scale - 1)) / 2, y: (r.height * (this.scale - 1)) / 2 };
        };
        const apply = () => {
          const l = limits();
          pos.x = Math.max(-l.x, Math.min(l.x, pos.x));
          pos.y = Math.max(-l.y, Math.min(l.y, pos.y));
          zoom.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${this.scale})`;
        };

        zoom.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'touch') return; /* sul telefono decide il pizzico del sistema */
          start = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
          moved = false;
          if (zoom.classList.contains('is-zoomed')) zoom.setPointerCapture(e.pointerId);
        });
        zoom.addEventListener('pointermove', (e) => {
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
          if (zoom.classList.contains('is-zoomed')) {
            pos = { x: start.px + dx, y: start.py + dy };
            apply();
          }
        });
        zoom.addEventListener('pointerup', (e) => {
          if (e.pointerType === 'touch') return;
          /* solo se il clic è iniziato qui: il rilascio del clic che apre la galleria non deve ingrandire */
          if (!start) return;
          const wasMoved = moved;
          start = null;
          if (wasMoved) return;
          if (zoom.classList.contains('is-zoomed')) {
            zoom.classList.remove('is-zoomed');
            zoom.style.transform = '';
            this.track.classList.remove('is-locked');
            return;
          }
          /* ingrandisci verso il punto toccato */
          const r = zoom.parentElement.getBoundingClientRect();
          pos = {
            x: (r.left + r.width / 2 - e.clientX) * (this.scale - 1),
            y: (r.top + r.height / 2 - e.clientY) * (this.scale - 1),
          };
          zoom.classList.add('is-zoomed');
          this.track.classList.add('is-locked');
          this.hint?.classList.add('is-hidden');
          apply();
        });
        zoom.addEventListener('pointercancel', () => { start = null; });
      }
    }
  );
}

/* ---------- Collezione: cursore del prezzo (guida i campi Da/A di Dawn) ---------- */
if (!customElements.get('isc-price-slider')) {
  customElements.define(
    'isc-price-slider',
    class IscPriceSlider extends HTMLElement {
      connectedCallback() {
        this.min = this.querySelector('[data-isc-ps-min]');
        this.max = this.querySelector('[data-isc-ps-max]');
        const range = this.nextElementSibling;
        this.inputs = range ? range.querySelectorAll('input.field__input') : [];
        const total = parseFloat(this.max.max) || 1;
        const paint = () => {
          let lo = +this.min.value, hi = +this.max.value;
          if (lo > hi - 1) { if (document.activeElement === this.min) lo = this.min.value = hi - 1; else hi = this.max.value = lo + 1; }
          this.style.setProperty('--lo', `${(lo / total) * 100}%`);
          this.style.setProperty('--hi', `${(hi / total) * 100}%`);
          this.querySelector('[data-isc-ps-lo]').textContent = lo;
          this.querySelector('[data-isc-ps-hi]').textContent = hi;
          return [lo, hi];
        };
        /* aggiorna i campi di Dawn solo al rilascio: il filtro si applica una volta sola */
        const commit = () => {
          const [lo, hi] = paint();
          if (this.inputs.length < 2) return;
          this.inputs[0].value = lo > 0 ? String(lo) : '';
          this.inputs[1].value = hi < total ? String(hi) : '';
          this.inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        };
        [this.min, this.max].forEach((r) => {
          r.addEventListener('input', paint);
          r.addEventListener('change', commit);
        });
      }
    }
  );
}

/* ---------- Collezione: box promo in posizione casuale ---------- */
/* Il box arriva in fondo alla griglia; qui lo spostiamo dopo un prodotto a caso.
   Posizioni pari, così su mobile (2 colonne) il box a tutta riga non lascia buchi.
   Si rifà da solo anche quando Dawn ridisegna la griglia dopo filtri o ordinamento. */
if (!customElements.get('isc-promo-slot')) {
  customElements.define(
    'isc-promo-slot',
    class IscPromoSlot extends HTMLElement {
      connectedCallback() {
        const item = this.closest('li[data-isc-random]');
        const grid = item?.parentElement;
        if (!item || !grid || item.dataset.placed) return;
        const products = [...grid.children].filter((el) => !el.classList.contains('isc-gpromo-item'));
        if (products.length < 2) return;
        const lo = Math.max(1, parseInt(item.dataset.min, 10) || 2);
        const hi = Math.min(products.length, parseInt(item.dataset.max, 10) || 14);
        const taken = [...grid.querySelectorAll('li[data-isc-random][data-placed]')].map((el) => +el.dataset.placed);
        const options = [];
        for (let n = lo; n <= hi; n++) {
          if (n % 2 === 0 && taken.every((t) => Math.abs(t - n) >= 4)) options.push(n);
        }
        if (!options.length) return;
        const after = options[Math.floor(Math.random() * options.length)];
        item.dataset.placed = String(after);
        products[after - 1].after(item);
      }
    }
  );
}

/* ---------- Stelle sopra il titolo: scendono alle recensioni (carosello o riquadro Judge.me) ---------- */
document.addEventListener('click', (e) => {
  const link = e.target.closest('a.isc-pdp__rating');
  if (!link) return;
  const target = document.querySelector('#judgeme_product_reviews, .jdgm-carousel-wrapper, .jdgm-all-reviews-widget');
  if (!target) return;
  e.preventDefault();
  const top = target.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top, behavior: 'smooth' });
});

/* ---------- Pagina prodotto: recensioni Judge.me a tendina ---------- */
(function () {
  const info = document.querySelector('product-info[data-isc-rv]');
  const widget = document.getElementById('judgeme_product_reviews');
  if (!info || !widget || widget.dataset.iscRv) return;
  widget.dataset.iscRv = '1';

  const wrap = document.createElement('div');
  wrap.className = 'isc-rv';
  const bar = document.createElement('button');
  bar.type = 'button';
  bar.className = 'isc-rv__bar';
  bar.setAttribute('aria-expanded', 'false');
  bar.innerHTML =
    '<span class="isc-rv__title">Recensioni clienti</span>' +
    '<span class="isc-rv__icon" aria-hidden="true"></span>';
  widget.parentNode.insertBefore(wrap, widget);
  wrap.appendChild(bar);
  const panel = document.createElement('div');
  panel.className = 'isc-rv__panel';
  /* chiusa con altezza 0 e non con display:none: Judge.me deve partire con la larghezza vera,
     altrimenti la prima pagina di recensioni resta vuota */
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  wrap.appendChild(panel);
  panel.appendChild(widget);

  const set = (open) => {
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    wrap.classList.toggle('is-open', open);
    bar.setAttribute('aria-expanded', String(open));
  };
  bar.addEventListener('click', () => set(!wrap.classList.contains('is-open')));

  /* "Recensioni per altri prodotti (438)" -> "Recensioni prodotti (438)" (Judge.me riscrive il widget, quindi si osserva) */
  const rename = () => {
    widget.querySelectorAll('.jm-other-products-reviews-text').forEach((el) => {
      if (/per altri prodotti/i.test(el.textContent)) el.textContent = el.textContent.replace(/per altri prodotti/i, 'prodotti');
    });
  };
  rename();
  new MutationObserver(rename).observe(widget, { childList: true, subtree: true, characterData: true });
  /* stelle sopra il titolo: apri e scendi */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('a.isc-pdp__rating')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    set(true);
    const top = wrap.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top, behavior: 'smooth' });
  }, true);
})();

/* ---------- Pagine informative: i grassetti tutti in maiuscolo diventano titoletti ---------- */
document.querySelectorAll('.isc-info__content .rte b, .isc-info__content .rte strong').forEach((el) => {
  const t = el.textContent.trim();
  if (t.length > 3 && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t)) el.classList.add('isc-rte-h');
});
/* via le righe vuote fatte di soli spazi */
document.querySelectorAll('.isc-info__content .rte span').forEach((el) => {
  if (!el.textContent.replace(/ /g, ' ').trim() && !el.children.length) el.remove();
});
