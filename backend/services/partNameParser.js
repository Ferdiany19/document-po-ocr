/**
 * Parse Part Name string from PO Document into components
 * 
 * Formats found in PO:
 * - "SPC270C T1 X 262 X C"        → SpecCode=SPC270C, Thick=1, Width=262, Length=0 (C→0)
 * - "SPH440-OD X1.8 X 358 X C"    → SpecCode=SPH440-OD, Thick=1.8, Width=358, Length=0
 * - "SPC590 T0.8 X 450 X C"       → SpecCode=SPC590, Thick=0.8, Width=450, Length=0
 * - "SPC590DU T1.2 X 500 X C"     → SpecCode=SPC590DU, Thick=1.2, Width=500, Length=0
 * - "SPC980DU 2.0 X 124 X C"      → SpecCode=SPC980DU, Thick=2.0, Width=124, Length=0
 * - "SPC590 1.2 X 313 X C"        → SpecCode=SPC590, Thick=1.2, Width=313, Length=0
 * 
 * @param {string} partName - Part Name string from PO document
 * @returns {Object} Parsed components: { specCode, thick, width, length1 }
 */
function parsePartName(partName) {
    if (!partName) return null;

    const cleaned = partName.trim()
        .replace(/×/g, 'X')
        .replace(/\*/g, 'X')
        .replace(/x/g, 'X');

    // Flexible regex to capture:
    // 1. SpecCode: Everything until the first dimension (number)
    // 2. Thick: The first number (possibly prefixed by T or X)
    // 3. Width: The second number
    // 4. Length: The rest (usually a number or 'C')

    // Pattern: [Spec] [Separator] [Thick] [Separator] [Width] [Separator] [Length]
    // Separators can be X, T, spaces, or combinations
    const regex = /^(.+?)\s+(?:[XT]\s*)?([\d.]+)\s*X\s*([\d.]+)\s*X\s*(.+)$/i;

    const match = cleaned.match(regex);
    if (!match) {
        console.warn(`Could not parse Part Name: "${partName}"`);
        return null;
    }

    const specCode = match[1].split(/\s+/)[0].trim(); // Take the first word as spec code
    const thick = parseFloat(match[2]);
    const width = parseFloat(match[3]);
    const lengthRaw = match[4].trim();

    // If last part is 'C', Length1 = 0; otherwise parse it as a number
    const length1 = lengthRaw.toUpperCase().startsWith('C') ? 0 : parseFloat(lengthRaw) || 0;

    return {
        specCode,
        thick,
        width,
        length1
    };
}

/**
 * Derive Tax code from SpecificationCode (first 2 characters)
 * E.g., "SPH440-OD" → "SP", "SPC270C" → "SP", "BJPC" → "BJ", "ALY" → "AL"
 */
function deriveTax(specCode) {
    if (!specCode) return '';
    return specCode.substring(0, 2).toUpperCase();
}

/**
 * Derive Facility code from SpecificationCode (first 3 characters)
 * E.g., "SPH440-OD" → "SPH", "SPC270C" → "SPC", "BJPC" → "BJP", "ALY" → "ALY"
 */
function deriveFacility(specCode) {
    if (!specCode) return '';
    return specCode.substring(0, 3).toUpperCase();
}

module.exports = { parsePartName, deriveTax, deriveFacility };
