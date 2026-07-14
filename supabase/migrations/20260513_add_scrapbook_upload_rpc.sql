CREATE OR REPLACE FUNCTION public.upsert_clipboard(
  slug_param text,
  title_param text,
  html_param text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF slug_param NOT IN (
    'scrapbook',
    'scrapbook-html-1', 'scrapbook-html-2', 'scrapbook-html-3',
    'scrapbook-html-4', 'scrapbook-html-5', 'scrapbook-html-6',
    'scrapbook-html-7', 'scrapbook-html-8', 'scrapbook-html-9',
    'scrapbook-html-10'
  ) THEN
    RAISE EXCEPTION 'slug not in allowlist: %', slug_param;
  END IF;

  INSERT INTO public.clipboard (slug, title, html_content, created_at)
  VALUES (slug_param, title_param, html_param, now())
  ON CONFLICT (slug) DO UPDATE
    SET title = EXCLUDED.title,
        html_content = EXCLUDED.html_content,
        created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_clipboard(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_clipboard(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_clipboard(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_clipboard(text, text, text) TO service_role;
