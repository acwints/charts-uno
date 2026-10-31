import { Fragment, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { seoPageBySlug, seoPages, type SeoPage } from '../content/seoPages';
import { NotFound } from './NotFound';
import './SeoPage.css';

interface SeoLandingPageProps {
  slug: string;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>
  ));
}

function Sample({ page }: { page: SeoPage }) {
  const max = Math.max(...page.sample.map((row) => row.value), 1);
  return (
    <figure className="seo-sample">
      <figcaption>{page.sampleCaption}</figcaption>
      <ul className="seo-bars">
        {page.sample.map((row) => (
          <li key={row.label}>
            <span className="seo-bar-label">{row.label}</span>
            <span className="seo-bar-track">
              <span className="seo-bar-fill" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
            </span>
            <span className="seo-bar-value">{row.value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function SeoArticle({ page }: { page: SeoPage }) {
  const others = seoPages.filter((item) => item.slug !== page.slug);
  return (
    <article className="seo">
      <p className="seo-kicker">Chartsuno</p>
      <h1>{page.h1}</h1>
      <p className="seo-lede">{page.lede}</p>
      <Sample page={page} />
      {page.blocks.map((block, index) => {
        if (block.type === 'h2') return <h2 key={index}>{block.text}</h2>;
        if (block.type === 'p') return <p key={index}><Inline text={block.text ?? ''} /></p>;
        if (block.type === 'pre') return <pre key={index}>{block.text}</pre>;
        if (block.type === 'ol' || block.type === 'ul') {
          const Tag = block.type;
          return (
            <Tag key={index}>
              {(block.items ?? []).map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}
            </Tag>
          );
        }
        return (
          <dl className="seo-faq" key={index}>
            {(block.faqs ?? []).map((faq) => (
              <Fragment key={faq.q}>
                <dt>{faq.q}</dt>
                <dd>{faq.a}</dd>
              </Fragment>
            ))}
          </dl>
        );
      })}
      <a className="seo-cta" href={page.ctaHref}>{page.ctaLabel}</a>
      <p className="seo-related">
        More guides:
        {others.map((item) => (
          <Link key={item.slug} to={`/${item.slug}`}>{item.h1}</Link>
        ))}
      </p>
    </article>
  );
}

export function SeoLandingPage({ slug }: SeoLandingPageProps) {
  const page = seoPageBySlug(slug);

  useEffect(() => {
    if (!page) return undefined;
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') ?? '';
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const previousCanonical = canonical.href;
    document.title = page.title;
    description?.setAttribute('content', page.description);
    canonical.href = `https://www.chartsuno.com/${page.slug}`;
    return () => {
      document.title = previousTitle;
      description?.setAttribute('content', previousDescription);
      if (createdCanonical) canonical?.remove();
      else canonical.href = previousCanonical;
    };
  }, [page]);

  if (!page) return <NotFound />;
  return <SeoArticle page={page} />;
}
