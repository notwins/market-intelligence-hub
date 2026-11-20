// The generator populates this function's server-side data before deployment.
const snapshot = /* ACE_SNAPSHOT */ null;
const origin = 'https://notwins.github.io';

export function GET(request) {
  const params = new URL(request.url).searchParams;
  const isin = params.get('isin');
  const currency = params.get('currency');
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  };
  if ([...params].length !== 2 || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin ?? '')
      || !/^[A-Z]{3}$/.test(currency ?? '')) {
    return Response.json({ error: 'Supply one ISIN and one ISO currency.' }, { status: 400, headers });
  }
  if (!snapshot) {
    return Response.json({ error: 'ACE snapshot unavailable.' }, { status: 503, headers });
  }
  const match = snapshot.results[isin + '|' + currency] ?? { state: 'missing' };
  return Response.json({ isin, currency, sheet: snapshot.sheet, workbookDate: snapshot.workbookDate, ...match }, {
    headers: { ...headers, 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  });
}
