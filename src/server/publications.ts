import { validatePublication, type Publication, type PublishedPuzzle } from '../game/publication';

const MAX_BODY = 128 * 1024;

export async function postPublication(
  request: Request, insert: (publication: Publication) => Promise<PublishedPuzzle>,
): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  if (Number(request.headers.get('content-length')) > MAX_BODY) return Response.json({ error: 'too_large' }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'invalid_json' }, { status: 400 });

  let bytes = 0;
  let body = '';
  let data: unknown;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY) {
        await reader.cancel();
        return Response.json({ error: 'too_large' }, { status: 413 });
      }
      body += decoder.decode(value, { stream: true });
    }
    data = JSON.parse(body + decoder.decode());
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  } finally {
    reader.releaseLock();
  }
  const publication = validatePublication(data);
  if (!publication) return Response.json({ error: 'invalid_publication' }, { status: 422 });
  try {
    const row = await insert(publication);
    const { id, puzzle, author, createdAt, creatorMoves, parentId } = row;
    return Response.json({ id, puzzle, author, createdAt, creatorMoves, parentId }, { status: 201 });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
