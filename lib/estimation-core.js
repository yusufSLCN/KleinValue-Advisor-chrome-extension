function buildEstimationPrompt(itemData, withImages = false) {
    const listedPriceLine =
        itemData.price != null ? `Listed Price: €${itemData.price}` : 'Listed Price: Unknown';
    const imagesList =
        !withImages && Array.isArray(itemData.images) && itemData.images.length
            ? itemData.images
                  .slice(0, 5)
                  .map((u, i) => `- ${i + 1}. ${u}`)
                  .join('\n')
            : '- None';

    let prompt = `You are an expert appraiser for consumer goods on Kleinanzeigen. Use ALL provided information (title, description, product specifications within the description if present, location${withImages ? ', and images' : ' and image URLs'}) to estimate a fair market value in Euros.

Return ONLY a JSON object with this exact schema, no extra text, markdown, or explanations:
{"value": number, "reasoning": string, "confidence": number}

Rules:
- "value" must be a numeric Euro amount (can be decimal). Do NOT include currency symbols or units in the JSON, only the number.
- "confidence" must be a number between 0-100 representing your confidence in the estimate (0 = very uncertain, 100 = absolutely certain).
- Base your estimate on description and product specs${withImages ? '; analyze the provided images for condition, quality, and features' : '; you may treat image URLs as additional context but you cannot fetch them'}.
- Keep "reasoning" concise (1-3 sentences).

Item Data:
Title: ${itemData.title}
Location: ${itemData.location || 'Unknown'}
${listedPriceLine}
Description (may include "Product Specifications:"):
${itemData.description || 'No description available'}
`;

    if (withImages) {
        prompt += `
📸 IMAGES ARE PROVIDED: Analyze the images to assess the item's condition, quality, and features.

Consider when estimating value:
- Visual condition and quality from images
- Brand recognition visible in images
- Wear and tear visible in photos
- Overall appearance and presentation
`;
    } else {
        prompt += `
Images (URLs):
${imagesList}

Consider when estimating value:
- Condition based on text description
- Brand recognition from description
`;
    }

    return prompt;
}

function parseEstimatorResponse(response) {
    try {
        let text = typeof response === 'string' ? response : String(response ?? '');
        text = text.trim();

        text = stripCodeFences(text);

        try {
            const obj = JSON.parse(text);
            const rawValue = obj.value ?? obj.price ?? obj.estimated_value ?? obj.estimate;
            const value = parseNumericEuro(rawValue);
            const reasoning = String(obj.reasoning ?? obj.reason ?? obj.explanation ?? '').trim();
            const confidence =
                typeof obj.confidence === 'number'
                    ? Math.max(0, Math.min(100, obj.confidence))
                    : 70;
            if (value !== null) {
                return {
                    value,
                    reasoning: reasoning || 'No reasoning provided',
                    confidence
                };
            }
        } catch (_) {
            const jsonStr = extractFirstJsonObjectString(text);
            if (jsonStr) {
                try {
                    const obj = JSON.parse(jsonStr);
                    const rawValue = obj.value ?? obj.price ?? obj.estimated_value ?? obj.estimate;
                    const value = parseNumericEuro(rawValue);
                    const reasoning = String(
                        obj.reasoning ?? obj.reason ?? obj.explanation ?? ''
                    ).trim();
                    const confidence =
                        typeof obj.confidence === 'number'
                            ? Math.max(0, Math.min(100, obj.confidence))
                            : 70;
                    if (value !== null) {
                        return {
                            value,
                            reasoning: reasoning || 'No reasoning provided',
                            confidence
                        };
                    }
                } catch (_) {
                    // continue
                }
            }
        }

        const jsonValueMatch = text.match(/"value"\s*:\s*([\-]?\d[\d.,]*)/i);
        if (jsonValueMatch) {
            const num = parseNumericEuro(jsonValueMatch[1]);
            if (num !== null) {
                return {
                    value: num,
                    reasoning: 'No reasoning provided'
                };
            }
        }

        let value = null;
        const valueLine = text.match(/^\s*VALUE\s*[:\-]\s*([€]?\s*\d[\d.,]*)/im);
        if (valueLine && valueLine[1]) {
            value = parseNumericEuro(valueLine[1]);
        }

        if (value === null) {
            const euroMatch = text.match(/[€]\s*\d[\d.,]*/);
            if (euroMatch) {
                value = parseNumericEuro(euroMatch[0]);
            }
        }

        if (value === null) {
            const numMatch = text.match(/\b\d[\d.,]{1,}\b/);
            if (numMatch) {
                value = parseNumericEuro(numMatch[0]);
            }
        }

        let reasoning = '';
        const reasoningMatch = text.match(/^\s*REASONING\s*[:\-]\s*(.+)$/im);
        if (reasoningMatch && reasoningMatch[1]) {
            reasoning = reasoningMatch[1].trim();
        } else {
            reasoning = text.length > 500 ? text.slice(0, 500) + '...' : text;
        }

        return {
            value: value !== null ? value : 0,
            reasoning: reasoning || 'No reasoning provided',
            confidence: 50
        };
    } catch (_) {
        return { value: 0, reasoning: 'No reasoning provided' };
    }
}

function parseNumericEuro(input) {
    if (input === null || input === undefined) return null;
    if (typeof input === 'number' && isFinite(input)) {
        return Math.round(input * 100) / 100;
    }
    let s = String(input).trim();
    if (!s) return null;

    s = s.replace(/[^\d.,-]/g, '');

    if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '');
        s = s.replace(',', '.');
    } else {
        s = s.replace(/,/g, '');
    }

    const num = parseFloat(s);
    if (!isFinite(num) || isNaN(num)) return null;

    return Math.round(num * 100) / 100;
}

function stripCodeFences(text) {
    if (!text) return text;
    const fenceMatch = text.match(/^```(?:json)?\n([\s\S]*?)\n```$/i);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim();
    }
    return text;
}

function extractFirstJsonObjectString(text) {
    if (!text) return null;
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                const candidate = text.slice(start, i + 1).trim();
                return candidate;
            }
        }
    }
    return null;
}

module.exports = {
    buildEstimationPrompt,
    parseEstimatorResponse,
    parseNumericEuro,
    stripCodeFences,
    extractFirstJsonObjectString
};
