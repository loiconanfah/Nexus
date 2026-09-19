/* ══════════════════════════════════════════════════════════════════════════════
   VIDÉOS DE DÉMONSTRATION — source unique (Accueil de l'application et page
   publique « Vidéos »).

   Déposez les fichiers dans `frontend/public/videos/` puis décrivez-les ici.
   `src` est le chemin SERVI (public/ est la racine du site) : un fichier
   `frontend/public/videos/tour.mp4` se référence donc par `/videos/tour.mp4`.
   `poster` est facultatif — une image d'aperçu, même emplacement.
   Tant que cette liste est vide, les deux écrans affichent un espace d'attente
   explicite au lieu d'un lecteur vide.
   ══════════════════════════════════════════════════════════════════════════ */
export type DemoVideo = {
  src: string
  poster?: string
  title: [string, string]
  body: [string, string]
  duration?: string
  /** Thème, pour regrouper les vidéos sur la page publique. */
  topic?: 'overview' | 'mapping' | 'simulation' | 'decision' | 'governance'
}

export const DEMO_VIDEOS: DemoVideo[] = []
