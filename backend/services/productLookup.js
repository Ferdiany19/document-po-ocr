const db = require('../db');

let productDB = [];
let isInitialized = false;

/**
 * Initialize the product lookup database from PostgreSQL Supabase
 */
async function init() {
    if (isInitialized) return;

    try {
        const result = await db.query('SELECT * FROM products ORDER BY id ASC');

        productDB = result.rows.map(row => ({
            specCode: String(row.spec_code || '').trim(),
            thick: parseFloat(row.thick) || 0,
            width: parseFloat(row.width) || 0,
            length1: parseFloat(row.length1) || 0,
            productNo: String(row.product_no || '').trim()
        }));

        isInitialized = true;
        console.log(`📦 Product DB loaded from PostgreSQL: ${productDB.length} entries`);
    } catch (err) {
        console.error('❌ Failed to initialize Product DB from PostgreSQL:', err);
        throw err;
    }
}

/**
 * Find Product No by matching SpecificationCode, Thick, Width, Length1
 * Uses fuzzy matching for floating point comparison
 * 
 * @param {string} specCode - Specification Code (e.g., "SPC270C")
 * @param {number} thick - Thickness value
 * @param {number} width - Width value
 * @param {number} length1 - Length1 value (0 if 'C' in Part Name)
 * @returns {Object|null} Matching product entry or null
 */
function findProduct(specCode, thick, width, length1) {
    if (!isInitialized) {
        throw new Error('Product lookup not initialized. Call init() first.');
    }

    // Helper function to clean specification codes for comparison
    const cleanSpec = (code) => {
        if (!code) return '';
        return code.toUpperCase()
            .replace(/-OD/g, '')
            .replace(/DU/g, '')
            .replace(/C$/g, '') // Remove trailing 'C'
            .trim();
    };

    const cleanInputSpec = cleanSpec(specCode);

    const result = productDB.find(p => {
        const cleanDbSpec = cleanSpec(p.specCode);

        return cleanDbSpec === cleanInputSpec &&
            Math.abs(p.thick - thick) < 0.01 &&
            Math.abs(p.width - width) < 0.5 &&
            Math.abs(p.length1 - length1) < 0.5;
    });

    if (!result) {
        console.warn(`⚠️ Product not found: SpecCode=${specCode} (Cleaned: ${cleanInputSpec}), Thick=${thick}, Width=${width}, Length1=${length1}`);
    }

    return result || null;
}

/**
 * Find Product No by matching ProductNo string directly
 * @param {string} productNo - The exact ProductNo string
 * @returns {Object|null} Matching product entry or null
 */
function findByProductNo(productNo) {
    if (!isInitialized) {
        throw new Error('Product lookup not initialized. Call init() first.');
    }

    if (!productNo) return null;

    const result = productDB.find(p => p.productNo && p.productNo.toUpperCase() === productNo.toUpperCase());

    if (!result) {
        console.warn(`⚠️ Product not found by ProductNo: ${productNo}`);
    }

    return result || null;
}

/**
 * Get the full product database (for debugging/display)
 */
function getDatabase() {
    return productDB;
}

module.exports = { init, findProduct, findByProductNo, getDatabase };
