# I'M So Curvy — tema Shopify

Tema Dawn 16 di **imsocurvy.it**, costruito sulla stessa base del tema Ormeshop (stesse sezioni,
funzioni, spazi e visibilità) e rifatto con la brand identity di I'M So Curvy.

## Brand

- **Colori:** bordeaux `#660033` (primario), vino scuro `#2b0717`/`#3d0c24`, rosa cipria `#f6d2dc`,
  rosa antico `#b8557e`, inchiostro `#241a1f`. Schemi colore in `config/settings_data.json`.
- **Font:** Jost (testi e titoli) e Playfair Display corsivo per le parole d'accento (`<em>`/`<strong>`
  nei titoli), come "Curvy" nel logo. Entrambi ospitati nel tema (`assets/*.woff2`).
- **Logo:** `logo_bl.png` / `logo_wh.png` dai file del negozio, copie in `assets/isc-logo*.png`.

## Struttura

- `assets/isc.css`, `assets/isc.js`: stile e script del tema (in fondo a `isc.css` il "livello brand").
- `sections/isc-*.liquid`, `snippets/isc-*.liquid`: sezioni e blocchi personalizzati
  (hero, stories, carosello prodotti, card promo, vantaggi, shop the look, newsletter e popup,
  footer, 404, traccia ordine, contatti, guida taglie, carrello con consegna stimata e upsell…).
- Icone: `snippets/isc-icon.liquid` (a linea) e `snippets/isc-jewel-icon.liquid` (animate,
  rosa metallizzato/vino/perla, gradienti in `snippets/isc-jewel-defs.liquid`).
- Guida taglie (blocco "Selettore varianti" della pagina prodotto): una riga per taglia,
  `taglia = seno | vita | fianchi`. La riga "vestibilità" della descrizione compare sotto le taglie.

## Sviluppo

```bash
shopify theme dev --store imsocurvy.myshopify.com
shopify theme check
shopify theme push --store imsocurvy.myshopify.com --unpublished
```
