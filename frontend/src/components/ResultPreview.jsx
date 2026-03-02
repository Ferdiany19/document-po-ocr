import { useState } from 'react';

const ResultPreview = ({ result, onReset }) => {
    const [activeTab, setActiveTab] = useState('summary');

    if (!result || !result.preview) return null;

    const { preview, downloadId } = result;
    const { poNo, poDate, remarks, batches, unmatchedItems } = preview;

    const handleDownload = () => {
        window.open(`http://localhost:5000/api/ocr/download/${downloadId}`, '_blank');
    };

    // Compile all items for the details tab
    const allItems = batches.flatMap(b =>
        b.items.map(item => ({ ...item, batchNo: b.batchNo, tax: b.tax, facility: b.facility }))
    );

    return (
        <div className="result-container">
            <div className="result-header">
                <div className="result-title">
                    <h2>OCR Extraction Success</h2>
                    <span className="badge success">Ready to Download</span>
                </div>
                <div className="action-buttons">
                    <button className="btn-secondary" onClick={onReset}>Scan Another</button>
                    <button className="btn-primary pulse" onClick={handleDownload}>
                        ⬇️ Download Excel Template
                    </button>
                </div>
            </div>

            <div className="po-summary-cards">
                <div className="card">
                    <div className="card-label">PO Number</div>
                    <div className="card-value">{poNo || '-'}</div>
                </div>
                <div className="card">
                    <div className="card-label">PO Date</div>
                    <div className="card-value">{poDate || '-'}</div>
                </div>
                <div className="card">
                    <div className="card-label">Total Items</div>
                    <div className="card-value">{preview.totalItems}</div>
                </div>
                {preview.tokenUsage && (
                    <div className="card">
                        <div className="card-label">Gemini Token Usage</div>
                        <div className="card-value small-text font-mono" style={{ color: '#93c5fd' }}>
                            {preview.tokenUsage.totalTokens.toLocaleString()}
                        </div>
                    </div>
                )}
            </div>

            {unmatchedItems > 0 && (
                <div className="warning-banner">
                    ⚠️ Terdapat {unmatchedItems} item yang tidak berhasil diparse atau tidak ditemukan di Master Database (Sheet 2).
                </div>
            )}

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                >
                    Batch Summary (Section 1)
                </button>
                <button
                    className={`tab ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('details')}
                >
                    Line Items (Section 2)
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'summary' && (
                    <div className="table-wrapper">
                        <table className="preview-table">
                            <thead>
                                <tr>
                                    <th>Batch No</th>
                                    <th>Commercial</th>
                                    <th>Customer</th>
                                    <th>Tax</th>
                                    <th>Facility</th>
                                    <th>PO No</th>
                                    <th>Items</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batches.map(batch => (
                                    <tr key={batch.batchNo}>
                                        <td>{batch.batchNo}</td>
                                        <td>Y</td>
                                        <td>CTF020IDR</td>
                                        <td><span className="highlight-tag">{batch.tax}</span></td>
                                        <td><span className="highlight-tag">{batch.facility}</span></td>
                                        <td>{poNo}</td>
                                        <td>{batch.itemCount}</td>
                                    </tr>
                                ))}
                                {batches.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="text-center">No batches generated</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'details' && (
                    <div className="table-wrapper">
                        <table className="preview-table">
                            <thead>
                                <tr>
                                    <th>Batch/Seq</th>
                                    <th>Product No</th>
                                    <th>Part Name (Original)</th>
                                    <th>Weight (Qty)</th>
                                    <th>Unit Price</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allItems.map((item, idx) => (
                                    <tr key={idx} className={item.found ? '' : 'error-row'}>
                                        <td>B{item.batchNo} / S{item.seqNo}</td>
                                        <td className="font-mono">{item.productNo || 'NOT FOUND'}</td>
                                        <td className="truncate" title={item.partName}>{item.partName}</td>
                                        <td>{item.quantity?.toLocaleString()}</td>
                                        <td>Rp {item.price?.toLocaleString()}</td>
                                        <td>Rp {item.amount?.toLocaleString()}</td>
                                        <td>
                                            {item.found ?
                                                <span className="status-dot success" title="Matched in DB"></span> :
                                                <span className="status-dot error" title="Not found in DB"></span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                                {allItems.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="text-center">No items found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultPreview;
