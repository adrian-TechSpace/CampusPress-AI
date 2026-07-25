create or replace function public.article_similarity_matches(
  input_article_id uuid,
  input_text text,
  match_limit integer default 5
)
returns table (
  article_id uuid,
  title text,
  similarity_score real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    articles.id as article_id,
    articles.title,
    extensions.similarity(articles.plain_text, coalesce(input_text, '')) as similarity_score
  from public.articles
  where articles.id <> input_article_id
    and articles.status = 'published'
    and length(trim(articles.plain_text)) > 0
  order by extensions.similarity(articles.plain_text, coalesce(input_text, '')) desc
  limit greatest(1, least(coalesce(match_limit, 5), 10));
$$;

revoke all on function public.article_similarity_matches(uuid, text, integer) from public;
grant execute on function public.article_similarity_matches(uuid, text, integer) to authenticated;
