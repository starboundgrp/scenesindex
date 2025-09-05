// This is a Vercel serverless function.
// It acts as a secure proxy to the Google Custom Search API.

export default async function handler(request, response) {
  // Get the API key and Search Engine ID from secure environment variables
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  // Get the search query from the request URL (e.g., /api/search?q=cats)
  const { searchParams } = new URL(request.url, `https://${request.headers.host}`);
  const query = searchParams.get('q');

  if (!query) {
    return response.status(400).json({ error: 'a search query "q" is required.' });
  }

  if (!apiKey || !searchEngineId) {
    return response.status(500).json({ error: 'api credentials are not configured on the server.' });
  }

  const googleApiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;

  try {
    const googleResponse = await fetch(googleApiUrl);
    const data = await googleResponse.json();
    // Send the results from Google back to the browser
    return response.status(200).json(data);
  } catch (error) {
    console.error('error fetching from google api:', error);
    return response.status(500).json({ error: 'failed to fetch search results.' });
  }
}