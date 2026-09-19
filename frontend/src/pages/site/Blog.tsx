import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock } from 'lucide-react'
import { useLang } from '../../lib/i18n'
import { usePageMeta } from '../../lib/seo'
import { POSTS, postBySlug, type Block, type Post } from '../../lib/blog'
import { BoxBtn, PageHero, SitePage, SocialLinks } from '../../components/site/Site'
import { EXTERNAL_POSTS } from '../../lib/social'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'

function formatDate(iso: string, lang: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Liste des articles. */
export function Blog() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  usePageMeta(t('Blog — Lenexux', 'Blog — Lenexux'),
    t('Méthodes et retours de terrain sur la cartographie des dépendances, le chiffrage d’impact et la décision.', 'Methods and field notes on dependency mapping, impact pricing and decision-making.'), '/blog')
  const [first, ...rest] = POSTS

  return (
    <SitePage>
      <PageHero eyebrow={t('Blog', 'Blog')} title={t('Méthodes, décisions, résilience', 'Methods, decisions, resilience')}
        sub={t('Comment rendre visibles les dépendances d’une organisation, chiffrer ce qu’une panne coûte, et décider en connaissant ses angles morts.',
          'How to make an organisation’s dependencies visible, price what an outage costs, and decide knowing your blind spots.')} />

      <section className="px-6 py-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          {first && (
            <button onClick={() => navigate(`/blog/${first.slug}`)} className="slb-card slb-card-link gap-6 p-8 text-left md:p-10">
              <div className="flex max-w-3xl flex-col gap-4">
                <Meta p={first} lang={lang} t={t} />
                <h2 style={{ fontFamily: geist, fontSize: 'clamp(1.5rem, 2.6vw, 2.2rem)', fontWeight: 600, lineHeight: 1.15, color: '#f7f7fb' }}>{t(...first.title)}</h2>
                <p style={{ color: '#a2a2b0', lineHeight: 1.65 }}>{t(...first.summary)}</p>
                <span className="mt-auto flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, color: '#7fe8f7', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {t('Lire l’article', 'Read the article')} <ArrowRight size={14} />
                </span>
              </div>
            </button>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            {rest.map((p, i) => (
              <button key={p.slug} onClick={() => navigate(`/blog/${p.slug}`)} className="slb-card slb-card-link flex flex-col gap-4 p-7 text-left">
                <Meta p={p} lang={lang} t={t} />
                <h3 style={{ fontFamily: geist, fontSize: 21, fontWeight: 600, lineHeight: 1.25, color: '#f3f3f6' }}>{t(...p.title)}</h3>
                <p style={{ color: '#a2a2b0', lineHeight: 1.6, fontSize: 15 }}>{t(...p.summary)}</p>
                <span className="mt-auto flex items-center justify-between" style={{ fontFamily: mono, fontSize: 12, color: '#7fe8f7', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {t('Lire', 'Read')} <span style={{ color: '#2f2f3a', fontSize: 28, fontFamily: geist }}>{String(i + 2).padStart(2, '0')}</span>
                </span>
              </button>
            ))}
          </div>

          {EXTERNAL_POSTS.length > 0 && (
            <div className="mt-6 flex flex-col gap-5 border-t pt-12" style={{ borderColor: '#17171f' }}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="slb-label self-start">{t('Publié ailleurs', 'Published elsewhere')}</div>
                  <p style={{ color: '#a2a2b0' }}>{t('Nos articles publiés sur d’autres plateformes. Suivez-nous :', 'Our articles published on other platforms. Follow us:')}</p>
                </div>
                <SocialLinks />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {EXTERNAL_POSTS.map((p) => (
                  <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" className="slb-card slb-card-link flex flex-col gap-3 p-6">
                    <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: mono, fontSize: 11.5, color: '#8a8a98', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      <span className="slb-label" style={{ padding: '3px 8px' }}>{p.source}</span>
                      <span>{formatDate(p.date, lang)}</span>
                      {p.lang !== lang && <span>{p.lang === 'en' ? t('En anglais', 'In English') : t('En français', 'In French')}</span>}
                    </div>
                    <span style={{ fontFamily: geist, fontSize: 19, fontWeight: 600, lineHeight: 1.3, color: '#f3f3f6' }}>{p.title}</span>
                    <span style={{ color: '#a2a2b0', fontSize: 14.5, lineHeight: 1.55 }}>{t(...p.summary)}</span>
                    <span className="mt-auto flex items-center justify-between gap-2" style={{ fontSize: 13, color: '#8a8a98' }}>
                      {t(...p.author)}
                      <span className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 12, color: '#7fe8f7', textTransform: 'uppercase' }}>{t('Lire sur', 'Read on')} {p.source} <ArrowUpRight size={13} /></span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </SitePage>
  )
}

function Meta({ p, lang, t }: { p: Post; lang: string; t: (fr: string, en: string) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: mono, fontSize: 11.5, color: '#8a8a98', textTransform: 'uppercase', letterSpacing: '.06em' }}>
      <span className="slb-label" style={{ padding: '3px 8px' }}>{t(...p.tag)}</span>
      <span>{formatDate(p.date, lang)}</span>
      <span className="flex items-center gap-1"><Clock size={12} />{t(`${p.readMinutes} min`, `${p.readMinutes} min`)}</span>
    </div>
  )
}

/** Un article. */
export function BlogPost() {
  const { slug = '' } = useParams()
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const post = postBySlug(slug)
  usePageMeta(post ? `${t(...post.title)} — Lenexux` : 'Blog — Lenexux', post ? t(...post.summary) : '', `/blog/${slug}`)

  if (!post) {
    return (
      <SitePage>
        <PageHero eyebrow="Blog" title={t('Article introuvable', 'Article not found')} sub={t('Ce lien ne correspond à aucun article publié.', 'This link does not match any published article.')}>
          <div className="mt-8"><BoxBtn onClick={() => navigate('/blog')} label={t('Tous les articles', 'All articles')} /></div>
        </PageHero>
      </SitePage>
    )
  }

  const idx = POSTS.findIndex((p) => p.slug === post.slug)
  const next = POSTS[idx + 1] ?? POSTS[0]
  return (
    <SitePage>
      <article>
        <header className="border-b px-6 pb-12 pt-14 md:pt-20" style={{ borderColor: '#14141a' }}>
          <div className="mx-auto flex max-w-[720px] flex-col gap-5">
            <button onClick={() => navigate('/blog')} className="flex w-fit items-center gap-1.5" style={{ fontFamily: mono, fontSize: 12, color: '#8a8a98', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <ArrowLeft size={14} /> {t('Blog', 'Blog')}
            </button>
            <Meta p={post} lang={lang} t={t} />
            <h1 style={{ fontFamily: geist, fontSize: 'clamp(2rem, 4.4vw, 3.1rem)', fontWeight: 600, lineHeight: 1.1, letterSpacing: '-.02em', color: '#fbfbfe' }}>{t(...post.title)}</h1>
            <p style={{ fontSize: 19, lineHeight: 1.6, color: '#b4b4c0' }}>{t(...post.summary)}</p>
            <div style={{ fontFamily: mono, fontSize: 12, color: '#6b6b78' }}>{t('Par l’équipe Lenexux', 'By the Lenexux team')}</div>
          </div>
        </header>
        <div className="px-6 py-14">
          <div className="slb-prose">
            {(lang === 'fr' ? post.body.fr : post.body.en).map((b, i) => <BlockView key={i} b={b} />)}
          </div>
        </div>
      </article>
      <section className="border-t px-6 py-14" style={{ borderColor: '#14141a' }}>
        <div className="mx-auto flex max-w-[720px] flex-col gap-6">
          {next && next.slug !== post.slug && (
            <button onClick={() => navigate(`/blog/${next.slug}`)} className="slb-card slb-card-link flex flex-col gap-2 p-6 text-left">
              <span style={{ fontFamily: mono, fontSize: 11, color: '#8a8a98', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('À lire ensuite', 'Read next')}</span>
              <span style={{ fontFamily: geist, fontSize: 20, fontWeight: 600, color: '#f3f3f6' }}>{t(...next.title)}</span>
            </button>
          )}
          <div className="flex flex-wrap gap-3">
            <BoxBtn primary onClick={() => navigate('/demo')} label={t('Voir la démo', 'See the demo')} />
            <BoxBtn onClick={() => navigate('/login?signup=1')} label={t('Créer un compte', 'Create an account')} />
          </div>
        </div>
      </section>
    </SitePage>
  )
}

function BlockView({ b }: { b: Block }) {
  if ('h' in b) return <h2>{b.h}</h2>
  if ('ul' in b) return <ul>{b.ul.map((x, i) => <li key={i}>{x}</li>)}</ul>
  if ('quote' in b) return <blockquote>{b.quote}</blockquote>
  return <p>{b.p}</p>
}
