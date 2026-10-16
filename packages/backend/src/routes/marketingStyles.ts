import { DESIGN_TOKENS_CSS } from '../generated/designTokens.js';
import { CABINET_GROTESK_BASE64 } from './fontData.js';

/**
 * DA "Billel" (design system perso, repo billel-skill), archétype b-marketing :
 * header + hero + footer "à copier tel quel" depuis b-header.md/b-hero.md/b-footer.md,
 * boutons/marqueurs depuis b-button.md/b-marker.md, tokens depuis token.css.
 * Remplace l'ancienne DA "hybrid" (carte étroite unique) : Google (revue Branding
 * OAuth) exigeait une vraie page d'accueil qui explique le produit, pas un dialogue
 * d'app. Sections `## Prose` (contenu texte, hors DS) ajoutées pour ce besoin précis,
 * pas de composant Billel dédié pour ça.
 */
export const MARKETING_CSS = `
@font-face {
  font-family: "Cabinet Grotesk";
  src: url("data:font/woff2;base64,${CABINET_GROTESK_BASE64}") format("woff2-variations");
  font-weight: 400 900;
  font-style: normal;
  font-display: swap;
}

${DESIGN_TOKENS_CSS}

/* Tout ce qui précède vient de la DA (src/generated/designTokens.ts, voir
   scripts/sync-tokens.mjs). Ce :root ne garde que ce qui est propre au site. */
:root {
  /* Conteneur des sections principales : pas de padding latéral, la marge auto
     fait le travail : sous 1280px, --b-side pour cent de marge de chaque
     côté, puis 1280px centrés au-delà.
     --b-side est la seule source de vérité de cette marge : la largeur du
     conteneur et les deux gouttières plus bas s'en déduisent, faute de quoi
     un changement de marge décalerait les blocs pleine largeur par rapport
     à la colonne de texte. Un nombre nu, et non un pourcentage : il sert
     aussi bien un calcul en % qu'un calcul en vw, et se relève d'une seule
     ligne sur petit écran (voir le palier juste après le :root). */
  --b-container: 1280px;
  /* Ancres du header : 15px, hors échelle de la DA (14 puis 16). À 14px, la
     nav paraissait trop petite à côté des boutons. À intégrer à la DA si le
     palier sert ailleurs. */
  --site-text-nav: 15px;
  --b-side: 2.5;
  --b-container-width: calc(100% - var(--b-side) * 2%);

  /* Biseau "hybride" (mêmes tokens que packages/plugin/src/styles.modern.css)
     appliqué aux boutons ; le reste de la marque (palette, layout, typo) est inchangé. */
  --hyb-hi: rgba(255, 255, 255, 0.9);
  --hyb-lo: rgba(18, 15, 13, 0.22);
  --hyb-lo-strong: rgba(18, 15, 13, 0.4);
  --hyb-out: inset -1px -1px var(--hyb-lo), inset 1px 1px var(--hyb-hi), inset -2px -2px var(--hyb-lo-strong),
    inset 2px 2px var(--hyb-hi);
  --hyb-pressed: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo-strong), inset -2px -2px var(--hyb-hi),
    inset 2px 2px var(--hyb-lo);
  --hyb-in: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo), inset -2px -2px var(--hyb-hi),
    inset 2px 2px var(--hyb-lo-strong);

  /* Marge latérale laissée par le conteneur, à l'identique de son calcul :
     --b-side pour cent de chaque côté sous 1280px, puis ce qui reste une fois
     les 1280px centrés. Sert aux blocs qui débordent du conteneur et doivent
     quand même démarrer sur sa colonne. Pas de vw ici : un pourcentage se mesure sur le
     bloc parent, donc hors barre de défilement, là où 100vw la compte et
     provoquerait un débordement horizontal de la page. */
  --b-gutter: max(
    calc(var(--b-side) * 1%),
    calc((100% - var(--b-container)) / 2)
  );
  /* Meme valeur que --b-gutter, mais en vw. Un pourcentage se resout sur le
     bloc parent, ce qui ne convient pas partout : dans un flex-basis, il se
     resout sur la piste, et non sur la largeur de page. Seule la barre de
     defilement separe les deux valeurs (~15px), sans consequence la ou
     celle-ci sert : un calcul de largeur de card, pas un padding de page. */
  --b-gutter-vw: max(calc(var(--b-side) * 1vw), calc((100vw - var(--b-container)) / 2));
}

/* Mobile et petite tablette : la marge passe à 3.75% de chaque côté, soit
   7.5% au total. Sur grand écran, elle reste à 2.5% de chaque côté, et au-delà
   de ~1347px le plafond de --b-container prend le relais de toute façon. Le
   palier tient à cette seule ligne : la largeur du conteneur et les deux
   gouttières dérivent de --b-side, et une propriété personnalisée ne se
   substitue qu'à l'usage, donc les redéfinir ici serait redondant. */
@media (max-width: 840px) {
  :root { --b-side: 3.75; }
}

* { box-sizing: border-box; }
html, body { margin: 0; }
/* Socle mobile et lissage : pas de flash au tap, pas d'agrandissement du texte
   au passage en paysage, pas de rebond qui détourne le défilement. */
html {
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}
/* Defilement doux sur les ancres du header, coupe des que l'utilisateur a
   demande moins d'animation (cf. le bloc prefers-reduced-motion en bas). */
html { scroll-behavior: smooth; }
body {
  font-family: var(--b-font-sans);
  color: var(--b-text);
  background: var(--b-surface);
  /* Encoche de l'iPhone en paysage : viewport-fit=cover étend la page sous
     l'encoche, ce retrait y ramène le contenu. Le fond de body couvre ce
     padding, donc rien ne change à l'œil ; env() vaut 0 partout ailleurs. */
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
a { color: inherit; }

/* ---------- Buttons (b-button) ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; text-decoration: none; font-family: inherit;
  line-height: var(--b-leading-tight); white-space: nowrap; flex-shrink: 0;
  transition: background-color var(--b-duration) var(--b-ease-default),
    color var(--b-duration-fast) var(--b-ease-default),
    transform var(--b-duration) var(--b-ease-out);
  touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.btn:focus-visible { outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); }
.btn:active:not(:disabled) { transform: scale(0.96); }
.cta {
  gap: var(--b-space-16); padding: var(--b-space-6) var(--b-space-12); border: 0;
  border-radius: 0; color: var(--b-ink); font-size: var(--b-text-base);
  font-weight: var(--b-font-bold); background-color: var(--b-accent);
  box-shadow: var(--hyb-out);
}
.cta:active { box-shadow: var(--hyb-pressed); }
/* Secondaire de la DA : contour à l'encre, fond encre au survol. L'orange
   reste au seul CTA (un bouton orange par vue). Correction optique : un contour
   sombre paraît plus grand qu'un aplat de même taille, et il ajoutait en
   plus 1px de chaque côté. Le padding retire ce pixel, puis un second sur
   l'axe horizontal, où l'écart se voyait le plus. */
.secondary {
  gap: var(--b-space-16); border: 1px solid var(--b-ink);
  padding: calc(var(--b-space-6) - 1px) calc(var(--b-space-12) - 2px);
  border-radius: 0; color: var(--b-ink); font-size: var(--b-text-base);
  font-weight: var(--b-font-bold); background-color: transparent;
  box-shadow: var(--hyb-out);
}
.secondary:active { box-shadow: var(--hyb-pressed); }
/* Traînée de pixels sur le CTA du header, lancée par Export dans la démo du
   hero : elle montre où se trouve le vrai plugin. Les pixels sont posés par
   le script ; le calque passe sous le libellé, au-dessus du fond. */
.cta { position: relative; isolation: isolate; }
.cta-trail { position: absolute; inset: 0; z-index: -1; overflow: clip; pointer-events: none; }
.cta-trail i { position: absolute; opacity: 0; }

/* Survol : seulement avec une vraie souris, sinon il colle après un tap sur
   écran tactile (le retour tactile passe par :active). */
@media (hover: hover) and (pointer: fine) {
  .cta:hover { background-color: var(--b-accent-hover); }
  .secondary:hover { background-color: var(--b-ink); color: var(--b-white); }
  .nav-link:hover { color: var(--b-ink); }
  .header__nav .nav-link:hover { color: var(--b-gray-600); }
  .carousel__btn:hover:not(:disabled) { background-color: var(--b-gray-200); }
}

/* ---------- Links (b-button) ---------- */
.nav-link {
  font-size: var(--b-text-sm); font-weight: var(--b-font-medium); color: var(--b-text-muted);
  text-decoration: none; transition: color var(--b-duration-slow) var(--b-ease-default);
  touch-action: manipulation;
}
.nav-link[aria-current="page"] { color: var(--b-ink); }
.text-link {
  color: var(--b-ink); font: inherit; text-decoration: underline;
}
.nav-link:focus-visible, .text-link:focus-visible {
  outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); border-radius: 0;
}

/* ---------- Header (b-header, compo marketing) ---------- */
.header {
  position: sticky; top: 0; z-index: 20; width: 100%;
  background: var(--b-surface); border-bottom: 1px solid transparent;
  transition: border-color var(--b-duration-slow) var(--b-ease-default);
}
.header--scrolled { border-bottom-color: var(--b-border); }
.header__inner {
  display: flex; align-items: center; justify-content: space-between; gap: var(--b-space-32);
  width: var(--b-container-width); max-width: var(--b-container); margin-inline: auto;
  padding-block: var(--b-space-16);
}
/* Trois zones a poids egal de part et d'autre de la nav (flex: 1 1 0 sur le
   lead et les actions) : la nav reste centree sur la page, et non sur ce qui
   reste entre un brand court et deux boutons larges. */
.header__lead { display: flex; align-items: center; gap: var(--b-space-32); flex: 1 1 0; }
.header__nav {
  display: flex; align-items: center; justify-content: center; gap: var(--b-space-24);
  flex: 0 1 auto;
}
/* Ancres du header seules : encre par defaut (plus de contraste qu'un
   .nav-link générique), et on éclaircit au survol plutôt que l'inverse. */
.header__nav .nav-link {
  color: var(--b-ink); font-size: var(--site-text-nav);
  /* Zone cliquable portée à ~42px de haut sans bouger la mise en page. */
  padding-block: var(--b-space-12); margin-block: calc(var(--b-space-12) * -1);
}
.header__nav .nav-link[aria-current="page"] { color: var(--b-text-muted); }
.header__brand {
  display: inline-flex; align-items: center; gap: var(--b-space-8); color: var(--b-ink);
  font-size: var(--b-text-base); font-weight: var(--b-font-bold); letter-spacing: var(--b-tracking-tight);
  text-decoration: none;
}
.header__brand-mark { width: 24px; height: 24px; flex: 0 0 auto; display: block; }
.header__brand:focus-visible {
  outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); border-radius: 0;
}
.header__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--b-space-20); flex: 1 1 0; }

/* ---------- Hero (b-hero) ---------- */
/* Composition à la Linear : le titre sur deux lignes, l'accroche dessous à
   8px, le CTA à droite sur la ligne de l'accroche, puis la démo en grand. */
.hero {
  display: flex; flex-direction: column; gap: var(--b-space-8);
  width: var(--b-container-width); max-width: var(--b-container);
  margin-inline: auto; /* 128px en haut : la DA s'arrête à --b-space-96, d'où le double de 64. */
  padding-block: calc(var(--b-space-64) * 2) var(--b-space-64);
}
.hero__title {
  max-width: 22ch; margin: 0; font-size: var(--b-text-6xl); font-weight: var(--b-font-bold);
  line-height: var(--b-leading-none); letter-spacing: var(--b-tracking-tighter); color: var(--b-ink);
  text-wrap: balance;
}
.hero__row {
  display: flex; align-items: flex-end; justify-content: space-between; gap: var(--b-space-32);
  margin-bottom: var(--b-space-32);
}
.hero__lede { max-width: 560px; margin: 0; font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }
.hero__actions { display: flex; align-items: center; gap: var(--b-space-16); flex: none; }
.hero__actions .btn { padding: var(--b-space-12) var(--b-space-16); }
.hero__demo { width: 100%; }

/* ---------- Content sections (prose, pas un composant Billel, besoin propre à cette page) ---------- */
.section {
  width: var(--b-container-width); max-width: var(--b-container); margin-inline: auto;
  padding-block: var(--b-space-64);
}
/* Cible d'ancre : le header est colle en haut, donc sans cette marge le titre
   de section se range juste dessous, hors de vue. */
.section[id] { scroll-margin-top: var(--b-space-32); }
.section__eyebrow {
  margin: 0 0 var(--b-space-12); font-size: var(--b-text-sm); font-weight: var(--b-font-semibold);
  letter-spacing: var(--b-tracking-wide); text-transform: uppercase; color: var(--b-text-muted);
}
.section__lede { margin: 0; font-size: var(--b-text-lg); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }
/* Bandeau qui déborde du conteneur : la section prend toute la largeur de
   page, et ses blocs de texte reprennent la colonne via .section__inner. */
.section--bleed { width: 100%; max-width: none; }
.section__inner {
  width: var(--b-container-width); max-width: var(--b-container); margin-inline: auto;
}
.section__title {
  margin: 0 0 var(--b-space-16); font-size: var(--b-text-3xl); font-weight: var(--b-font-bold);
  letter-spacing: var(--b-tracking-tight); color: var(--b-ink);
  text-wrap: balance;
}
/* Sur les pages légales, .section__title sert d'intertitre de prose et non
   d'accroche de section : il reste au palier du dessous. */
.legal .section__title { font-size: var(--b-text-3xl); }
/* Ces règles habillent le texte courant d'une section, et rien d'autre : d'où
   l'enfant direct et le :not([class]). Un simple .section p (0,1,1)
   l'emportait sur toute classe de composant (0,1,0) et débordait sur les
   cards et le carrousel : .section ul collait 24px de padding à la piste,
   ce qui empêchait le carrousel de revenir à scrollLeft 0, et .section p
   forçait les surtitres à 16px. Dire "un paragraphe sans classe" plutôt que
   "tout paragraphe" met tout composant à l'abri, présent comme futur. */
.section > p:not([class]) { margin: 0 0 var(--b-space-16); font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: pretty; }
.section > p:not([class]):last-child { margin-bottom: 0; }
.section > ul:not([class]) { margin: var(--b-space-8) 0 var(--b-space-16); padding-left: var(--b-space-24); }
.section > ul:not([class]) > li { font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); margin-bottom: var(--b-space-8); text-wrap: pretty; }
.legal .section { max-width: 680px; }
.legal .section__title--page { font-size: var(--b-text-3xl); text-align: center; padding-top: var(--b-space-32); }
.legal .meta { text-align: center; font-size: var(--b-text-xs); line-height: var(--b-leading-relaxed); color: var(--b-text-faint); margin: 0 0 var(--b-space-48); text-wrap: pretty; }

/* ---------- Grille de cards (étapes, points d'accès Google) ---------- */
.card-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--b-space-20);
  margin: var(--b-space-32) 0 0; padding: 0; list-style: none;
}

/* ---------- Card (prose, un seul modèle pour "What Decker does" et "How it works") ----------
   Aperçu illustré en haut sur surface blanche, puis surtitre, titre et
   description. Les deux sections partagent le composant : seul le conteneur
   change (grille pour les étapes, piste défilante pour les points forts). */
/* Relief 95 sur la palette moderne, comme le skin hybride du plugin : la card
   est un panneau en relief (--hyb-out) et son aperçu un puits en creux
   (--hyb-in), au lieu d'un aplat bordé d'1px. Le biseau remplace la bordure,
   d'où sa disparition sur .card__media. */
.card {
  display: flex; flex-direction: column; gap: var(--b-space-24);
  background: var(--b-surface-muted); border-radius: 0; padding: var(--b-space-24);
  box-shadow: var(--hyb-out);
}
/* Ratio fixe : les aperçus restent alignés entre eux quelle que soit la
   longueur des textes en dessous. */
.card__media {
  display: block; width: 100%; aspect-ratio: 7 / 5;
  background: var(--b-surface); box-shadow: var(--hyb-in);
}
.card__body { display: flex; flex-direction: column; gap: var(--b-space-8); }
/* Capitales comme le surtitre de section, d'un palier plus petit pour que les
   deux niveaux restent distincts. */
.card__eyebrow {
  margin: 0; font-size: var(--b-text-xs); font-weight: var(--b-font-semibold);
  letter-spacing: var(--b-tracking-wide); text-transform: uppercase; color: var(--b-text-faint);
}
.card__title { margin: 0; font-size: var(--b-text-lg); font-weight: var(--b-font-bold); color: var(--b-ink); text-wrap: balance; }
.card__desc { margin: 0; font-size: var(--b-text-base); font-weight: var(--b-font-medium); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: pretty; }
.card--compact { gap: var(--b-space-16); }
/* Poussée en pied de card (margin-top: auto) pour que les notes s'alignent
   d'une card à l'autre malgré des descriptions de longueurs différentes.
   Le filet est une rainure gravée 95 : un trait sombre doublé d'un trait
   clair, plutôt qu'une bordure 1px plate. */
.card__note {
  margin: var(--b-space-8) 0 0; margin-top: auto; padding-top: var(--b-space-16);
  border-top: 1px solid var(--hyb-lo); box-shadow: inset 0 1px var(--hyb-hi);
  font-size: var(--b-text-xs); color: var(--b-text-faint);
}
.card__note code { font-size: 1em; color: var(--b-ink); font-weight: var(--b-font-semibold); }

/* ---------- Carrousel de cards (prose) ----------
   Six points forts : trop pour une grille lisible, donc une piste qui défile
   horizontalement. Elle prend toute la largeur de page et se contente d'un
   padding égal à la gouttière du conteneur : les cards démarrent donc sur la
   colonne du texte, mais continuent de courir jusqu'au bord de l'écran au
   lieu d'être coupées au bord du conteneur. On voit ainsi la suivante
   dépasser à droite, et les précédentes dépasser à gauche une fois
   défilé. Le scroll-padding aligne l'accrochage sur cette même colonne. */
.carousel__track {
  display: flex; gap: var(--b-space-20); margin: var(--b-space-32) 0 0; list-style: none;
  padding: 0 var(--b-gutter); scroll-padding-inline: var(--b-gutter);
  /* overflow-x: auto seul passe aussi l'axe vertical en auto, et la DA pose
     overscroll-behavior: contain sur tout élément : la piste devenait un
     conteneur vertical qui avalait la molette sans la rendre à la page (même
     bug que le rail du plugin). L'axe vertical est donc fermé, et seul l'axe
     horizontal garde le contain. */
  overflow-x: auto; overflow-y: hidden; overscroll-behavior: contain auto;
  scroll-snap-type: x mandatory; scroll-behavior: smooth;
  scrollbar-width: none;
}
/* Pendant un glisser, scrollLeft est piloté à la main : l'accrochage doit se
   taire, sinon il ramène la piste à chaque image. Il reprend au relâchement,
   ce qui produit l'accrochage final. */
/* Curseur de préhension pour annoncer que la piste se tire à la souris. Posé
   par le script seulement quand elle déborde : sur une piste qui tient à
   l'écran, il promettrait un geste sans effet. */
.carousel__track--grabbable { cursor: grab; }
.carousel__track--dragging { scroll-snap-type: none; scroll-behavior: auto; cursor: grabbing; user-select: none; }
.carousel__track::-webkit-scrollbar { display: none; }
/* La piste court jusqu'aux bords de l'écran : l'anneau passe à l'intérieur,
   sinon ses côtés sortiraient de la page. */
.carousel__track:focus-visible {
  outline: var(--b-focus-outline); outline-offset: calc(var(--b-focus-offset) * -2); border-radius: 0;
}
/* La card suivante doit toujours dépasser : c'est le seul signal qu'il y a
   une suite, et un lisere de quelques pixels ne se lit pas comme tel : il
   passe pour un bord mal coupe. La largeur vise donc une demi-card visible,
   quelle que soit la taille de l'ecran.

   Le decompte ne part pas de la largeur de la piste mais de ce qui s'en voit.
   La piste fait toute la largeur de page et porte le gouttiere en padding :
   la premiere card demarre donc sur la colonne de texte, mais la zone visible
   court jusqu'au bord droit de l'ecran, soit une gouttiere de plus que la
   boite de contenu. C'est ce qui ruinait le calcul precedent, pose en simple
   pourcentage de la piste : sur un ecran large, ou la gouttiere enfle pour
   centrer un conteneur plafonne a 1280px, la gouttiere de rab suffisait a
   loger presque entierement la card suivante, qui passait alors pour une
   quatrieme colonne complete.

   D'ou V = 100% + une gouttiere, et pour n cards pleines plus une moitie :
   n x w + n x gouttiere-de-piste + w / 2 = V, soit w = (V - n x 20px) / (n + 0,5).
   Deux cards et demie sur grand ecran (environ 530px de large, a la maniere
   des cards de Dock en 560 x 460) : les visuels respirent. Les paliers en
   dessous reprennent la formule avec n = 1. */
.carousel__item {
  flex: 0 0 calc((100% + var(--b-gutter-vw) - 40px) / 2.5);
  scroll-snap-align: start;
}
.carousel__controls { display: flex; justify-content: flex-end; gap: var(--b-space-8); padding-top: var(--b-space-48); }
.carousel__btn {
  width: 40px; height: 40px; padding: 0; border: 0; border-radius: 0;
  background-color: var(--b-surface-muted); color: var(--b-ink); box-shadow: var(--hyb-out);
}
.carousel__btn:active:not(:disabled) { box-shadow: var(--hyb-pressed); }
.carousel__btn:disabled { color: var(--b-gray-200); cursor: default; }
.carousel__btn:disabled:active { transform: none; }
.carousel__btn svg { width: 20px; height: 20px; display: block; }

.section__cta { display: flex; justify-content: flex-end; margin-top: var(--b-space-32); }
.section__cta .btn { padding: var(--b-space-12) var(--b-space-16); }

/* ---------- Footer (b-footer, compo marketing) ---------- */
.footer {
  width: 100%; border-top: 1px solid var(--b-border);
}
.footer__inner {
  width: var(--b-container-width); max-width: var(--b-container); margin-inline: auto;
  padding-block: var(--b-space-48) calc(var(--b-space-48) + env(safe-area-inset-bottom));
}
.footer__top { display: flex; justify-content: space-between; gap: var(--b-space-48); margin-bottom: var(--b-space-64); flex-wrap: wrap; }
.footer__brand { display: flex; flex-direction: column; align-items: flex-start; gap: var(--b-space-16); }
.footer__brand-row { display: flex; align-items: center; gap: var(--b-space-12); }
.footer__brand-mark { width: 24px; height: 24px; flex: 0 0 auto; display: block; }

/* Logo du footer = déclencheur de l'easter egg (easterEgg.ts). Un vrai
   bouton, cible étendue à 44px par un pseudo-élément. */
.footer__egg {
  position: relative; display: block; padding: 0; border: 0; border-radius: 0;
  background: none; color: inherit; font: inherit; cursor: pointer;
  touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.footer__egg::before { content: ""; position: absolute; inset: -10px; }
.footer__egg:focus-visible { outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); }
.footer__egg-tip {
  position: absolute; bottom: calc(100% + var(--b-space-8)); inset-inline-start: 0;
  padding: var(--b-space-4) var(--b-space-8); white-space: nowrap; pointer-events: none;
  background: var(--b-ink); color: var(--b-white);
  font-size: var(--b-text-xs); font-weight: var(--b-font-medium); line-height: var(--b-leading-tight);
  opacity: 0; transform: translateY(4px);
  transition: opacity var(--b-duration) var(--b-ease-out), transform var(--b-duration) var(--b-ease-out);
}
.footer__egg:focus-visible .footer__egg-tip { opacity: 1; transform: none; }
@media (hover: hover) and (pointer: fine) {
  .footer__egg:hover .footer__egg-tip { opacity: 1; transform: none; }
}
/* Au survol, les trois cartes du logo se ferment de l'avant vers l'arrière,
   puis se rouvrent de l'arrière vers l'avant, en boucle : des fenêtres qui
   reviennent sans fin, le principe du jeu. Bascule sèche (steps), comme une
   fenêtre des années 2000 qui s'ouvre d'un coup. Rien en mouvement réduit. */
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  @keyframes egg-front { 0% { opacity: 1; } 10% { opacity: 0; } 70% { opacity: 1; } }
  @keyframes egg-mid { 0% { opacity: 1; } 20% { opacity: 0; } 60% { opacity: 1; } }
  @keyframes egg-back { 0% { opacity: 1; } 30% { opacity: 0; } 50% { opacity: 1; } }
  .footer__egg:hover .egg-card { animation: 1.6s steps(1, end) infinite; }
  .footer__egg:hover .egg-card--front { animation-name: egg-front; }
  .footer__egg:hover .egg-card--mid { animation-name: egg-mid; }
  .footer__egg:hover .egg-card--back { animation-name: egg-back; }
}
.footer__meta { margin: 0; font-size: var(--b-text-xs); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: pretty; }
.footer__cols { display: flex; gap: var(--b-space-64); flex-wrap: wrap; }
.footer__col { display: flex; flex-direction: column; gap: var(--b-space-12); }
.footer__col-title { margin: 0 0 var(--b-space-4); font-size: var(--b-text-sm); font-weight: var(--b-font-semibold); color: var(--b-ink); }
.footer__bottom {
  display: flex; justify-content: space-between; align-items: center; gap: var(--b-space-24);
  padding-top: var(--b-space-32); border-top: 1px solid var(--b-border); flex-wrap: wrap;
}
.footer__note { margin: 0; font-size: var(--b-text-xs); color: var(--b-text-muted); text-wrap: pretty; }
.footer__legal { display: flex; gap: var(--b-space-24); }

/* Lien d'évitement : premier élément focalisable, visible au focus seulement. */
.skip-link {
  position: absolute; inset-inline-start: var(--b-space-16); top: var(--b-space-8); z-index: 30;
  padding: var(--b-space-8) var(--b-space-12); background: var(--b-surface); color: var(--b-ink);
  font-size: var(--b-text-sm); font-weight: var(--b-font-semibold); text-decoration: none;
  box-shadow: var(--hyb-out); transform: translateY(-200%);
}
.skip-link:focus-visible { transform: none; outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); }
main:focus { outline: none; }

/* Entrée du hero, une seule fois au chargement (première impression, tier
   "plaisir"). Blocs sémantiques échelonnés de 100 ms : opacity + flou 4px +
   translateY(12px), 300 ms ease-out. Jamais bloquant : le contenu reste
   cliquable et visible sans JS. */
@media (prefers-reduced-motion: no-preference) {
  @keyframes hero-enter {
    from { opacity: 0; filter: blur(4px); transform: translateY(12px); }
    to { opacity: 1; filter: blur(0); transform: none; }
  }
  .hero > * {
    animation: hero-enter 300ms var(--b-ease-out) both;
  }
  .hero > :nth-child(2) { animation-delay: 100ms; }
  .hero > :nth-child(3) { animation-delay: 200ms; }
}
/* Mouvement réduit : fondu seul, plus de glissement ni de flou. */
@media (prefers-reduced-motion: reduce) {
  @keyframes hero-fade { from { opacity: 0; } to { opacity: 1; } }
  .hero > * { animation: hero-fade 300ms var(--b-ease-out) both; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .carousel__track { scroll-behavior: auto; }
}

@media (max-width: 960px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Paliers du carrousel. Ils ne suivent pas ceux de la mise en page : ce qui
   les declenche n'est pas le nombre de colonnes de la page mais la largeur en
   dessous de laquelle une card devient trop etroite pour son texte. Sous les
   ~300px de card, les descriptions se cassent en lignes de trois mots, et la
   piste se lit comme une colonne compressee plutot que comme un carrousel :
   chaque palier retire donc une card avant d'en arriver la. La formule reste
   celle du bloc .carousel__item, avec n cards pleines plus une fraction ;
   la fraction se resserre en descendant, faute de quoi la moitie de card en
   trop mangerait sur mobile la place qui manque deja. */
@media (max-width: 1160px) {
  .carousel__item { flex-basis: calc((100% + var(--b-gutter-vw) - 20px) / 1.6); }
}
@media (max-width: 600px) {
  .carousel__item { flex-basis: calc((100% + var(--b-gutter-vw) - 20px) / 1.2); }
}

@media (max-width: 720px) {
  .hero__title { font-size: var(--b-text-5xl); }
  .hero { padding-top: var(--b-space-64); }
  .hero__row { flex-direction: column; align-items: flex-start; gap: var(--b-space-24); }
  /* Le brand, la nav et les boutons ne tiennent plus sur une seule ligne : au
     lieu de laisser les boutons se compresser (leur texte passait alors sur
     deux lignes), seule la ligne d'actions passe dessous. Les ancres restent
     sur la ligne du brand, poussees a droite par un lead extensible, et les
     boutons s'alignent a gauche sous l'ensemble. */
  .header__inner { flex-wrap: wrap; row-gap: var(--b-space-12); }
  .header__lead { flex: 1 1 auto; }
  .header__nav { order: 1; flex: 0 1 auto; justify-content: flex-end; gap: var(--b-space-16); }
  .header__actions { order: 2; width: 100%; flex: 0 0 auto; justify-content: flex-start; }
  /* Le header tient sur deux lignes a ce palier, trois sur les ecrans les plus
     etroits : les ancres visent d'autant plus bas, sur le cas le plus haut,
     pour ne jamais ranger le surtitre de section dessous. */
  .section[id] { scroll-margin-top: var(--b-space-96); }
  .footer__top { flex-direction: column; }
  .footer__bottom { flex-direction: column; align-items: flex-start; }
  .card-grid { grid-template-columns: 1fr; }
  .section__cta { justify-content: flex-start; }
}

/* Paliers propres au header, a placer apres le bloc 720px : ils posent les
   memes proprietes a specificite egale, et c'est donc l'ordre de cascade qui
   decide. Ce qui les declenche est la largeur en dessous de laquelle le brand
   et les trois ancres cessent de tenir sur une ligne. Les ancres etant un
   repere secondaire, elles cedent avant le brand et les boutons : d'abord les
   gouttieres, puis le corps de texte. En dessous de ~340px de large, plus rien
   ne les fait tenir : elles reprennent alors leur propre ligne, sans deborder. */
@media (max-width: 560px) {
  .header__inner { gap: var(--b-space-16); }
  .header__nav { gap: var(--b-space-12); flex-wrap: wrap; }
  .header__nav .nav-link { font-size: var(--b-text-sm); }
}
@media (max-width: 400px) {
  .header__nav { gap: var(--b-space-8); }
  .header__nav .nav-link { font-size: var(--b-text-xs); }
}
`;
