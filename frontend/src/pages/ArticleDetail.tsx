import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { fetchArticle } from '../api/client';
import {
  formatEditorialDate,
  getEditorialArticleDomain,
  getEditorialCardTags,
} from './quotes-home-browser/editorialCardHelpers';
import { tagPillStyle } from '../utils/filterTags';

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const navigate = useNavigate();

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['article', numericId],
    queryFn: () => fetchArticle(numericId),
    enabled: !Number.isNaN(numericId),
  });

  const articleDomain = getEditorialArticleDomain(article?.url);

  return (
    <div className="min-h-screen" style={{ background: '#faf7f2' }}>
      <main className="overflow-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
              className="text-sm hover:underline"
              style={{ color: '#8a8070', fontFamily: 'Lora, serif' }}
            >
              &larr; Back
            </button>
          </div>

          {isLoading && (
            <div className="text-center py-16">
              <div
                className="inline-block w-8 h-8 border-4 rounded-full animate-spin"
                style={{ borderColor: '#e8dcc8', borderTopColor: '#c9a84c' }}
              />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {(error as Error).message}
            </div>
          )}

          {article && (
            <>
              <header className="mb-6">
                <p
                  className="text-xs uppercase tracking-wider font-semibold mb-2"
                  style={{ color: '#8b6914', fontFamily: 'Playfair Display, serif' }}
                >
                  Article
                </p>
                <h1
                  className="text-2xl md:text-3xl leading-snug"
                  style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}
                >
                  {article.title || 'Untitled'}
                </h1>
                <div
                  className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                  style={{ color: '#8a8070', fontFamily: 'Lora, serif' }}
                >
                  {article.publication && (
                    <span className="italic">{article.publication}</span>
                  )}
                  {article.published_date && (
                    <span>{formatEditorialDate(article.published_date) ?? article.published_date}</span>
                  )}
                  {articleDomain && (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <span>{articleDomain}</span>
                      <Link2 size={13} />
                    </a>
                  )}
                </div>
              </header>

              <section>
                <h2
                  className="text-xs uppercase tracking-wider font-semibold mb-3"
                  style={{ color: '#8b6914', fontFamily: 'Playfair Display, serif' }}
                >
                  Quotes ({article.quotes.length})
                </h2>

                {article.quotes.length === 0 ? (
                  <p
                    className="text-sm italic"
                    style={{ color: '#9a9080', fontFamily: 'Lora, serif' }}
                  >
                    No approved quotes from this article.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {article.quotes.map((q) => {
                      const tags = getEditorialCardTags(q);
                      const dateSaid = formatEditorialDate(q.date_said);
                      return (
                        <Link
                          key={q.id}
                          to={`/quotes/${q.id}`}
                          className="block bg-white border-l-4 rounded-r-lg shadow-sm hover:shadow transition-shadow"
                          style={{ borderLeftColor: '#c9a84c' }}
                        >
                          <div className="px-5 md:px-6 py-5">
                            <blockquote
                              className="text-base md:text-lg leading-relaxed italic"
                              style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}
                            >
                              &ldquo;{q.quote_text}&rdquo;
                            </blockquote>
                            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                              <span style={{ color: '#c9a84c', fontFamily: 'Playfair Display, serif' }}>
                                &mdash;
                              </span>
                              {q.person ? (
                                <span
                                  className="font-semibold"
                                  style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}
                                >
                                  {q.person.name}
                                </span>
                              ) : (
                                <span style={{ color: '#6b6560' }}>Unknown</span>
                              )}
                              {q.person?.role && (
                                <span className="text-xs" style={{ color: '#8b7550' }}>
                                  &middot; {q.person.role}
                                </span>
                              )}
                              {dateSaid && (
                                <span className="text-xs ml-auto" style={{ color: '#a09880' }}>
                                  {dateSaid}
                                </span>
                              )}
                            </div>
                            {tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {tags.map((tag) => {
                                  const style = tagPillStyle({
                                    category: tag.category,
                                    value: tag.name,
                                    label: tag.label,
                                  });
                                  return (
                                    <span
                                      key={tag.key}
                                      className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                                      style={style}
                                    >
                                      {tag.label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
