# Impact Climatique Benin

Site de visualisation des indicateurs climatiques du Benin.

## Donnees

- **Source principale** : [Donnees Publiques du Benin - Benin Climate Change](https://donneespubliques.gouv.bj/datasets/benin-climate-change-d28fc158-46e4-44e7-b6f9-7e962c0bc0b2)
- Indicateurs World Bank Climate Change (aussi disponibles sur [HDX](https://data.humdata.org/dataset/world-bank-climate-change-indicators-for-benin))

## Lancement local

```bash
npm run build-data   # Genere le JSON depuis les CSV
npm run serve        # Lance le serveur sur http://localhost:3000
```

## Deploiement Netlify

1. Connectez votre compte [Netlify](https://app.netlify.com) a GitHub
2. Choisissez le depot `benin-climate-change`
3. Parametres de build (pre-remplis par netlify.toml):
   - **Build command**: `node scripts/build-data.js`
   - **Publish directory**: `public`
4. Cliquez sur "Deploy site"

Le site sera accessible sur une URL du type `https://nom-projet.netlify.app`.
