// Vercel serverless function — proxies to Supabase to expose card diagnostics.
// Use: /api/diag?card=FS-0114
const SUPABASE_URL = 'https://ufbqscikufkbcpzlpllr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmYnFzY2lrdWZrYmNwemxwbGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjQ0NTcsImV4cCI6MjA4OTQ0MDQ1N30.IxOaF1Un22BrRJNBYJuNj2AdHhUOgqSefoT1ok5gqh4';

async function sb(path) {
  const r = await fetch(SUPABASE_URL + path, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
    },
  });
  return r.ok ? r.json() : null;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const cardCode = url.searchParams.get('card') || 'FS-0114';

  const cards = await sb(`/rest/v1/cards?card_code=eq.${encodeURIComponent(cardCode)}&select=*`);
  const card = Array.isArray(cards) && cards[0];

  let listing = null;
  if (card?.listing_id) {
    const lr = await sb(`/rest/v1/listings?id=eq.${card.listing_id}&select=*`);
    listing = Array.isArray(lr) && lr[0] ? lr[0] : null;
  }

  let profile = null;
  if (card?.agent_id) {
    const pr = await sb(`/rest/v1/profiles?id=eq.${card.agent_id}&select=id,first_name,last_name,phone,brokerage,license_number,email`);
    profile = Array.isArray(pr) && pr[0] ? pr[0] : null;
  }

  // Diagnose what the buyer-tap front-end will do for this card
  let path;
  if (!card) path = 'NOT_FOUND_in_db';
  else if (!card.listing_id) path = 'CARD_NOT_ASSIGNED (no listing_id)';
  else if (card.status === 'paused') path = 'CARD_NOT_ASSIGNED (paused)';
  else if (card.status === 'archived') path = 'CARD_NOT_ASSIGNED (archived)';
  else if (!listing) path = 'CARD_NOT_FOUND (listing missing)';
  else path = 'normal-render';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send(JSON.stringify(
    {
      url_check: `https://forsalenfc.vercel.app/?t=${cardCode}`,
      diagnosed_buyer_path: path,
      card,
      listing,
      properties_count: Array.isArray(listing?.properties_json) ? listing.properties_json.length : 0,
      properties: listing?.properties_json ?? null,
      profile,
    },
    null,
    2
  ));
};
