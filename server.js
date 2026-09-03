const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple in-memory cache for Wikipedia API responses
const apiCache = new Map();
// Keywords indicating disasters, tragedies, or accidents
const TRAGEDY_KEYWORDS = [
    'kill', 'died', 'dead', 'crash', 'collapse', 'sank', 'disaster',
    'fire', 'explosion', 'earthquake', 'storm', 'tsunami', 'epidemic',
    'war', 'assassination', 'massacre', 'murder', 'accident', 'terror'
];

app.post('/api/doom-date', async (req, res) => {
    try {
        const { birthDate, birthTime } = req.body;
        if (!birthDate) {
            return res.status(400).json({ error: 'Birth date is required (YYYY-MM-DD).' });
        }

        // Extract month and two-digit day
        const [year, rawMonth, rawDay] = birthDate.split('-');
        const mm = String(parseInt(rawMonth, 10)).padStart(2, '0');
        const dd = String(parseInt(rawDay, 10)).padStart(2, '0');

        // Official Wikimedia "On this day" endpoint
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`;
        const cacheKey = `${mm}-${dd}`;
        let data;

        if (apiCache.has(cacheKey)) {
            data = apiCache.get(cacheKey);
        } else {
            try {
                data = await new Promise((resolve, reject) => {
                    const req = https.get(wikiUrl, {
                        headers: {
                            'User-Agent': `DoomDateApp/1.0 (tronracer0@gmail.com)`
                        }
                    }, (res) => {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            return reject(new Error(`Wikipedia API responded with status ${res.statusCode}`));
                        }

                        let body = '';
                        res.on('data', chunk => body += chunk);
                        res.on('end', () => {
                            try {
                                resolve(JSON.parse(body));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });

                    req.on('error', reject);

                    // Add a 5 second timeout so it doesn't hang indefinitely
                    req.setTimeout(5000, () => {
                        req.destroy();
                        reject(new Error('Wikipedia API request timed out'));
                    });
                });

                apiCache.set(cacheKey, data);
            } catch (apiError) {
                console.warn(`Wikipedia API failed: ${apiError.message}. Falling back to cosmic anomaly.`);
                data = { events: [], deaths: [] };
            }
        }
        const allEvents = [...(data.events || []), ...(data.deaths || [])];

        // Filter events containing tragedy keywords
        const allTragedies = allEvents.filter(item => {
            const text = item.text.toLowerCase();
            return TRAGEDY_KEYWORDS.some(kw => text.includes(kw));
        });

        // Only use tragedies that happened on the exact birth year
        const tragedies = allTragedies.filter(item => item.year == year);

        let primaryDoom;
        let doomScore;

        const calculateTragedyScore = (text) => {
            let score = 0;
            const lower = text.toLowerCase();
            
            // Base score from keywords
            TRAGEDY_KEYWORDS.forEach(kw => {
                if (lower.includes(kw)) score += 1;
            });
            
            // Extract numbers near casualty words (e.g. "830,000 people killed" or "killed 10")
            const matches = lower.match(/(?:\b(\d{1,3}(?:,\d{3})*|\d{2,})\b\s+(?:people|civilians|soldiers|victims)?\s*(?:were\s+)?(?:killed|dead|died|perished))|(?:(?:killed|kills|dead|deaths of)\s+([~]?\d{1,3}(?:,\d{3})*|\d{2,}))/g);
            if (matches) {
                const maxNum = Math.max(...matches.map(m => parseInt(m.replace(/\D/g, '')) || 0));
                score += maxNum;
            }

            // High-multiplier words
            if (/(million|thousand)\s+(people\s+)?(killed|dead|died)/.test(lower)) score += 10000;

            return score;
        };

        if (tragedies.length > 0) {
            // Sort by tragedy score descending, tie-break by text length
            tragedies.sort((a, b) => (calculateTragedyScore(b.text) - calculateTragedyScore(a.text)) || (b.text.length - a.text.length));
            const selected = tragedies[0];
            const pageWithImage = selected.pages?.find(p => p.originalimage || p.thumbnail);
            
            const isExactYear = (selected.year == year);
            
            primaryDoom = {
                year: selected.year,
                event: selected.text,
                exactMatch: isExactYear,
                links: selected.pages?.[0]?.content_urls?.desktop?.page || null,
                imageUrl: pageWithImage?.originalimage?.source || pageWithImage?.thumbnail?.source || null
            };
            
            // If it's an exact year match, doom score is 100%, else 75-99%
            doomScore = isExactYear ? 100 : Math.floor(Math.random() * 25) + 75;
        } else {
            // Fallback: If Wikipedia has no logged disaster for that day
            primaryDoom = {
                year: year,
                event: `At precisely ${birthTime || '12:00'}, You were born. This is the greatest tragedy that unfolded that Day.....`,
                exactMatch: true,
                isFallback: true,
                links: null
            };
            doomScore = 99;
        }

        // Format response
        return res.json({
            userInput: { birthDate, birthTime },
            doomScore: `${doomScore}%`,
            event: primaryDoom,
            matchedTragediesCount: tragedies.length,
            warningMessage: `Your birth was synchronized with the misfortune of ${primaryDoom.year}.`
        });

    } catch (error) {
        console.error('Error processing doom query:', error);
        res.status(500).json({ error: 'Failed to summon doom records.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Doom server active on http://localhost:${PORT}`);
});