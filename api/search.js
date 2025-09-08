// This is a Vercel serverless function.
// It acts as a secure proxy to the Google Custom Search API.

export default async function handler(request, response) {
  // Get the API key and Search Engine ID from secure environment variables
  // They are now comma-separated lists
  const apiKeys = (process.env.GOOGLE_API_KEYS || '').split(',').map(key => key.trim()).filter(Boolean);
  const searchEngineIds = (process.env.GOOGLE_SEARCH_ENGINE_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

  // Get the search query from the request URL
  const { searchParams } = new URL(request.url, `https://${request.headers.host}`);
  const query = searchParams.get('q');

  if (!query) {
    return response.status(400).json({ error: 'a search query "q" is required.' });
  }

  if (apiKeys.length === 0 || searchEngineIds.length === 0 || apiKeys.length !== searchEngineIds.length) {
    console.error('server error: api credentials not found or mismatched. check vercel environment variables. ensure GOOGLE_API_KEYS and GOOGLE_SEARCH_ENGINE_IDS have the same number of comma-separated values.');
    return response.status(500).json({ error: 'api credentials are not configured on the server.' });
  }

  // --- Key Rotation Logic ---
  // We will try each key until one works or all of them fail.
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    const searchEngineId = searchEngineIds[i];
    const googleApiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;
    
    // For debugging, log the URL being called (without the key)
    const urlForLogging = `https://www.googleapis.com/customsearch/v1?cx=${searchEngineId}&q=${encodeURIComponent(query)}`;
    console.log(`Attempting search with key index ${i}. URL fragment: ${urlForLogging}`);

    try {
      const googleResponse = await fetch(googleApiUrl);
      const data = await googleResponse.json();

      // Check for any error from the Google API
      if (data.error) {
        console.error(`Google API error for key index ${i}:`, JSON.stringify(data.error, null, 2));

        if (data.error.code === 429) {
        // If it's the last key in the list, then all keys are exhausted.
        if (i === apiKeys.length - 1) {
          console.error('all api keys have reached their daily limit.');
          return response.status(429).json({ error: 'daily search limit reached for all keys.' });
        }
        // Otherwise, continue to the next key in the loop.
        continue;
        }
        // For other errors (like "Invalid Argument"), we can stop and report it,
        // as trying another key is unlikely to fix it.
        return response.status(400).json(data);
      }

      // If the request was successful, send the data and stop.
      response.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
      return response.status(200).json(data);

    } catch (error) {
      console.error(`error fetching from google api with key index ${i}:`, error);
      // If there's a network error, we can also try the next key.
      // If it's the last key, we'll fall through and return a generic error.
    }
  }

  // This part is reached only if all keys failed for reasons other than quota limits (e.g., network errors)
  return response.status(500).json({ error: 'failed to fetch search results from all available sources.' });
}
