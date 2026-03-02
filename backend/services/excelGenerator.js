const XLSX = require('xlsx');
const path = require('path');
const { parsePartName, deriveTax, deriveFacility } = require('./partNameParser');
const productLookup = require('./productLookup');

/**
 * Generate Excel file matching the template_output.xlsx format
 * 
 * Template structure:
 * Rows 1-2: Section 1 headers (Batch No, Commercial, Kanban, SO Date, etc.)
 * Row 3+:   Section 1 data (one row per batch group by Tax/Facility)
 * Then:     Section 2 headers (Batch No, Seq No, Delivery Place, Product No, etc.)
 * Then:     Section 2 data (detail line items)
 * 
 * @param {Object} poData - Parsed PO data from pdfParser
 * @param {string} outputPath - Path to save the generated Excel file
 * @returns {Object} Preview data for frontend
 */
async function generateExcel(poData, outputPath) {
    await productLookup.init();

    const today = new Date();
    const soDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    // Process each item: map productNo to DB
    const processedItems = [];
    const unmatchedItems = [];

    for (const item of poData.items) {
        if (!item.partName) {
            unmatchedItems.push({ ...item, error: 'Item missing partName' });
            continue;
        }

        const parsed = parsePartName(item.partName);
        if (!parsed) {
            unmatchedItems.push({ ...item, error: 'Could not parse Part Name string correctly' });
            continue;
        }

        const product = productLookup.findProduct(
            parsed.specCode,
            parsed.thick,
            parsed.width,
            parsed.length1
        );

        const tax = parsed.specCode.substring(0, 2).toUpperCase();
        const facility = parsed.specCode.substring(0, 3).toUpperCase();
        const actualProductNo = product ? product.productNo : null;

        processedItems.push({
            ...item,
            productNo: actualProductNo,
            tax,
            facility,
            found: !!product, // Indicate if it actually exists in DB PM Fujiseat
            parsed: parsed
        });
    }

    // Group items by Tax + Facility combination for batches
    const batchGroups = {};
    for (const item of processedItems) {
        const key = `${item.tax}_${item.facility}`;
        if (!batchGroups[key]) {
            batchGroups[key] = {
                tax: item.tax,
                facility: item.facility,
                items: []
            };
        }
        batchGroups[key].items.push(item);
    }

    const batches = Object.values(batchGroups);

    // Build the Excel workbook
    const wb = XLSX.utils.book_new();
    const wsData = [];

    // === SECTION 1: Batch Header ===
    // Row 1: Header labels
    wsData.push([
        'Batch No', 'Commercial', 'Kanban', 'SO Date (*)', 'Handling Class (*)',
        'Customer (*)', 'Sales PIC (*)', 'Tax', 'Facility', 'Settle Term (*)',
        'Currency (*)', 'PO No (*) ', 'Delivery Tolerance (%)', 'Note'
    ]);

    // Row 2: Format description
    wsData.push([
        'Batch No', 'Y/N', 'Y/N', 'DD/MM/YYYY', 'O/C',
        'Customer Code', 'PIC Code', 'Tax Code', 'Facility Code', 'Term Code',
        'Currency Code', 'Cust PO No'
    ]);

    // Row 3+: One row per batch
    batches.forEach((batch, idx) => {
        wsData.push([
            idx + 1,          // Batch No
            'Y',              // Commercial
            'Y',              // Kanban
            soDate,           // SO Date
            'O',              // Handling Class
            'CTF020IDR',      // Customer Code
            'DIS015',         // Sales PIC
            batch.tax,        // Tax (2 chars from spec)
            batch.facility,   // Facility (3 chars from spec)
            'N30',            // Settle Term
            'IDR',            // Currency
            poData.poNo,      // PO No from document
            10                // Delivery Tolerance
        ]);
    });

    // === SECTION 2: Detail Items ===
    // Header row
    wsData.push([
        'Batch No', 'Seq No ', 'Delivery Place (*)', 'Product No', 'Part No',
        'Part Name', 'Location (*)', 'Plant (*)', 'Model', 'Maker', 'Mill',
        'Commodity', 'Spec', 'Coating', 'Oiling', 'Thick', 'Width',
        'Length 1', 'Length 2', 'Qty (*)', 'Weight (*)', 'UOM (*)',
        'Unit Price (*)', 'Amount (*)', 'Delivery Date (*)', 'Delivery Time', 'Remark'
    ]);

    // Format description row
    wsData.push([
        'Batch No', 'Sequence No', 'Ship To Code', 'Product No', 'Part No',
        'Part Name', 'Location Code', 'Plant Code', 'Model', 'Maker Code', 'Mill Code',
        'Commodity Code', 'Spec Code', 'Coating Code', 'Oiling', 'Thick', 'Width ',
        'Length 1', 'Length 2', 'Qty', 'Weight', 'KG/MT/SHEET/PACK',
        'Unit Price', 'Amount', 'Delivery Date', 'Delivery Time', 'Remark'
    ]);

    // Detail rows
    batches.forEach((batch, batchIdx) => {
        batch.items.forEach((item, seqIdx) => {
            // Parse delivery date to Excel serial if possible
            let deliveryDate = item.deliveryDate || '';

            wsData.push([
                batchIdx + 1,         // Batch No
                seqIdx + 1,           // Seq No
                'RCF25',              // Delivery Place
                item.productNo || '', // Product No (from DB lookup)
                null,                 // Part No
                item.partName || '',  // Part Name
                'USSC',               // Location Code (statis)
                'WCC',                // Plant Code (statis)
                null,                 // Model
                null,                 // Maker
                null,                 // Mill
                null,                 // Commodity
                null,                 // Spec
                null,                 // Coating
                null,                 // Oiling
                null,                 // Thick
                null,                 // Width
                null,                 // Length 1
                null,                 // Length 2
                100,                  // Qty (statis = 100)
                item.quantity,        // Weight (Quantity dari PO)
                'KG',                 // UOM (statis)
                item.price,           // Unit Price (Price dari PO)
                item.amount,          // Amount (Amount dari PO)
                deliveryDate,         // Delivery Date
                null,                 // Delivery Time
                poData.remarks || ''  // Remark
            ]);
        });
    });

    // Create worksheet and save
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
        { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 10 },
        { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
        { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
        { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
        { wch: 14 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, outputPath);

    // Return preview data for frontend
    return {
        poNo: poData.poNo,
        poDate: poData.poDate,
        remarks: poData.remarks,
        soDate,
        totalItems: poData.items.length,
        processedItems: processedItems.length,
        unmatchedItems: unmatchedItems.length,
        batches: batches.map((b, idx) => ({
            batchNo: idx + 1,
            tax: b.tax,
            facility: b.facility,
            itemCount: b.items.length,
            items: b.items.map((item, seqIdx) => ({
                seqNo: seqIdx + 1,
                partName: item.partName,
                productNo: item.productNo,
                quantity: item.quantity,
                price: item.price,
                amount: item.amount,
                deliveryDate: item.deliveryDate,
                found: item.found,
                parsed: item.parsed
            }))
        })),
        unmatched: unmatchedItems.map(item => ({
            partName: item.partName,
            error: item.error
        }))
    };
}

module.exports = { generateExcel };
