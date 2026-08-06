import { Router } from 'express';

export const pagesRouter = Router();

const LAST_UPDATED = '6 août 2026';
const CONTACT_EMAIL = 'bibi33.bt@gmail.com';

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1.5rem; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; }
  a { color: #1a56db; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Spec §5.3 / Google OAuth verification — page d'accueil publique requise pour le Branding du consent screen. */
pagesRouter.get('/', (_req, res) => {
  res.type('html').send(
    page(
      'Decker — Figma vers Google Slides',
      `<h1>Decker</h1>
<p>Decker est un plugin Figma qui exporte une maquette Figma directement en présentation Google Slides, en conservant mise en page, styles et thème.</p>
<p><a href="/privacy">Politique de confidentialité</a> · <a href="/terms">Conditions d'utilisation</a></p>
<p>Contact : <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>`,
    ),
  );
});

pagesRouter.get('/privacy', (_req, res) => {
  res.type('html').send(
    page(
      'Decker — Politique de confidentialité',
      `<h1>Politique de confidentialité</h1>
<p>Dernière mise à jour : ${LAST_UPDATED}</p>

<h2>Ce que fait Decker</h2>
<p>Decker est un plugin Figma qui convertit une maquette Figma en présentation Google Slides. Pour créer cette présentation dans votre compte Google, Decker vous demande de vous connecter avec votre compte Google (OAuth).</p>

<h2>Données Google auxquelles Decker accède</h2>
<ul>
  <li><strong>Google Slides API</strong> — pour créer et remplir la présentation que vous demandez d'exporter.</li>
  <li><strong>Google Drive API (scope <code>drive.file</code>)</strong> — accès limité aux seuls fichiers créés par Decker lui-même. Decker ne peut pas lire ni modifier vos autres fichiers Drive.</li>
  <li><strong>Adresse e-mail</strong> (scope <code>userinfo.email</code>) — utilisée uniquement pour afficher, dans le plugin, quel compte Google est actuellement connecté.</li>
</ul>

<h2>Ce que Decker ne fait pas</h2>
<p>Decker ne lit, ne stocke ni ne partage le contenu de vos fichiers Figma ou Google Drive au-delà de ce qui est strictement nécessaire pour réaliser l'export que vous demandez. Aucune donnée n'est vendue ni partagée avec des tiers.</p>

<h2>Conservation des données</h2>
<p>Les images exportées depuis Figma sont temporairement hébergées le temps de l'export, puis supprimées automatiquement une fois la présentation créée (généralement en quelques minutes, au maximum une heure). Le jeton de connexion Google (refresh token) est stocké chiffré afin de vous éviter de vous reconnecter à chaque export ; vous pouvez le révoquer à tout moment depuis <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>.</p>

<h2>Contact</h2>
<p>Pour toute question sur vos données ou une demande de suppression, écrivez à <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
    ),
  );
});

pagesRouter.get('/terms', (_req, res) => {
  res.type('html').send(
    page(
      "Decker — Conditions d'utilisation",
      `<h1>Conditions d'utilisation</h1>
<p>Dernière mise à jour : ${LAST_UPDATED}</p>
<p>Decker est fourni "tel quel", sans garantie d'aucune sorte, dans le cadre d'un projet personnel. Vous restez seul responsable du contenu que vous exportez via le plugin.</p>
<p>L'usage du plugin implique l'usage de votre compte Google via l'authentification OAuth décrite dans la <a href="/privacy">politique de confidentialité</a>.</p>
<p>Pour toute question, contactez <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
    ),
  );
});
