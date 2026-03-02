const pdf = require('pdf-parse');
const fs = require('fs');

/**
 * Parse PO PDF document and extract structured data
 * @param {string} filePath - Path to PDF file
 * @returns {Object} Extracted PO data
 */
async function parsePDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const text = data.text;

    // Extract PO No
    const poNoMatch = text.match(/PO\s*No\s*[:\s]*([A-Z]?\d+)/i);
    const poNo = poNoMatch ? poNoMatch[1].trim() : '';

    // Extract PO Date
    const poDateMatch = text.match(/PO\s*Date\s*[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i);
    const poDate = poDateMatch ? poDateMatch[1].trim() : '';

    // Extract Remarks
    const remarksMatch = text.match(/Remarks\s*[:\s]*([^\n]+)/i);
    const remarks = remarksMatch ? remarksMatch[1].trim() : '';

    // Extract table items
    const items = extractTableItems(text);

    return {
        poNo,
        poDate,
        remarks,
        items,
        totalItems: items.length
    };
}

/**
 * Extract table items from PDF text
 * Table columns: No. | Part Number | Product Code | Part Name | Qty/Case | Quantity | Unit | Curr | Price | Amount | Delivery Date
 */
function extractTableItems(text) {
    const items = [];
    const fullText = text.replace(/\r/g, '');

    // Brittle row regex disabled. Relying entirely on our robust Alt strategy.
    return extractTableItemsAlt(fullText);
}

/**
 * Robust table extraction that searches for Part Name anchors
 */
function extractTableItemsAlt(text) {
    const items = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Improved Part Name matcher: Look for Material Spec (letters/numbers/dash) 
        // followed by Thick (X or T, with or without space), Width (X), Length
        const partNameMatch = line.match(/([A-Z0-9]+(?:-[A-Z0-9]+)?(?:DU)?)\s+(?:[XT]\s*)?([\d.]+)\s*X\s*([\d.]+)\s*X\s*([A-Z0-9]+)/i);

        if (partNameMatch) {
            const partName = partNameMatch[0].trim();

            // The text from pdf-parse is heavily fragmented.
            // Let's grab a much larger chunk of lines around the part name (e.g. 5 lines before and 10 after)
            const contextRaw = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 8)).join(' ');

            // Remove any commas from numbers first to make matching easier, or just match them directly
            const allNumbers = contextRaw.match(/[\d,]+\.\d{2}/g) || [];

            // Convert to clean floats and filter out 0.00
            const significantNumbers = allNumbers.map(n => parseNumber(n)).filter(n => n > 0);

            // Defaults
            let quantity = 0, price = 0, amount = 0;

            if (significantNumbers.length >= 3) {
                // Usually the first non-zero is Qty, second is Price, third is Amount (or reversed depending on layout)
                // Let's look at relative sizes. Amount is usually the largest, Price is smallest, Qty is mid.
                // Or simply follow the typical column order: Qty, Price, Amount
                const numLen = significantNumbers.length;
                quantity = significantNumbers[numLen - 3];
                price = significantNumbers[numLen - 2];
                amount = significantNumbers[numLen - 1];
            } else if (significantNumbers.length === 2) {
                // Sometimes Qty is a flat integer, not .00. Let's find integer numbers around partName
                const intMatches = contextRaw.match(/(?<!\.)\b\d{1,5}\b(?!\.)/g) || [];
                // Filter out years and basic small numbers that might be sequential IDs
                const integers = intMatches.map(n => parseInt(n)).filter(n => n > 2000 || (n > 10 && n < 1900));

                quantity = integers.length > 0 ? integers[0] : 0; // Assume first valid integer is Qty
                price = significantNumbers[0];
                amount = significantNumbers[1];
            } else if (significantNumbers.length > 0) {
                // Try one more fallback: grab the very last 2 numbers on the same line if possible
                const inline = line.match(/[\d,]+\.\d{2}/g) || [];
                if (inline.length >= 2) {
                    price = parseNumber(inline[0]);
                    amount = parseNumber(inline[1]);
                }
            }

            // Extract delivery date
            const dateMatch = contextRaw.match(/(\d{1,2}-\w{3}-\d{2,4})/);
            const deliveryDate = dateMatch ? dateMatch[1] : '';

            // Extract part number (format like 27010-262C, 44018-358C)
            const partNumberMatch = contextRaw.match(/(\d{5}-\d{2,4}[A-Z]?)/);
            const partNumber = partNumberMatch ? partNumberMatch[1] : '';

            items.push({
                no: items.length + 1,
                partNumber,
                productCode: '',
                partName,
                quantity,
                price,
                amount,
                deliveryDate
            });
        }
    }

    return items;
}

/**
 * Parse a number string like "7,036.00" to float
 */
function parseNumber(str) {
    if (!str) return 0;
    return parseFloat(str.toString().replace(/,/g, '')) || 0;
}

module.exports = { parsePDF };
