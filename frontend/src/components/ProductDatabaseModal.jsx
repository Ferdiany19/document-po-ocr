import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

const ProductDatabaseModal = ({ onClose }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form state for Add/Edit
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        specCode: '',
        thick: '',
        width: '',
        length1: '',
        productNo: ''
    });

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/products`);
            setProducts(response.data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch products:', err);
            setError('Failed to load database. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleOpenForm = (product = null) => {
        if (product) {
            setEditingId(product.id);
            setFormData({
                specCode: product.spec_code,
                thick: product.thick || '',
                width: product.width || '',
                length1: product.length1 || '',
                productNo: product.product_no
            });
        } else {
            setEditingId(null);
            setFormData({
                specCode: '',
                thick: '',
                width: '',
                length1: '',
                productNo: ''
            });
        }
        setIsFormOpen(true);
        setError(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.specCode || !formData.productNo) {
            setError('Specification Code and Product No are required.');
            return;
        }

        const payload = {
            specCode: formData.specCode,
            thick: parseFloat(formData.thick) || 0,
            width: parseFloat(formData.width) || 0,
            length1: parseFloat(formData.length1) || 0,
            productNo: formData.productNo
        };

        try {
            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/products/${editingId}`, payload);
            } else {
                await axios.post(`${API_BASE_URL}/api/products`, payload);
            }
            setIsFormOpen(false);
            fetchProducts();
        } catch (err) {
            console.error('Failed to save product:', err);
            setError('Failed to save product. Check constraints.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                await axios.delete(`${API_BASE_URL}/api/products/${id}`);
                fetchProducts();
            } catch (err) {
                console.error('Failed to delete product:', err);
                setError('Failed to delete product.');
            }
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content db-modal">
                <div className="modal-header">
                    <h2>📦 Product Master Database</h2>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div className="error-message mb-4">
                            <span className="error-icon">⚠️</span>
                            {error}
                        </div>
                    )}

                    {isFormOpen ? (
                        <div className="form-card">
                            <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                            <form onSubmit={handleSave} className="product-form">
                                <div className="form-group">
                                    <label>Specification Code *</label>
                                    <input
                                        type="text"
                                        name="specCode"
                                        value={formData.specCode}
                                        onChange={handleChange}
                                        placeholder="e.g. SPC590-OD"
                                        className="input-field"
                                        required
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Thick</label>
                                        <input type="number" step="0.01" name="thick" value={formData.thick} onChange={handleChange} className="input-field" placeholder="1.2" />
                                    </div>
                                    <div className="form-group">
                                        <label>Width</label>
                                        <input type="number" step="0.1" name="width" value={formData.width} onChange={handleChange} className="input-field" placeholder="222" />
                                    </div>
                                    <div className="form-group">
                                        <label>Length1 (0 for C)</label>
                                        <input type="number" step="0.1" name="length1" value={formData.length1} onChange={handleChange} className="input-field" placeholder="0" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Product No * (Maps from Database)</label>
                                    <input
                                        type="text"
                                        name="productNo"
                                        value={formData.productNo}
                                        onChange={handleChange}
                                        placeholder="e.g. 61440"
                                        className="input-field"
                                        required
                                    />
                                </div>
                                <div className="form-actions">
                                    <button type="button" className="btn-secondary" onClick={() => setIsFormOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn-primary">Save Product</button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <>
                            <div className="table-controls mb-4">
                                <button className="btn-primary" onClick={() => handleOpenForm()}>+ Add Product</button>
                                <span className="text-muted ml-3">Total: {products.length} entries</span>
                            </div>

                            {loading ? (
                                <div className="loading-state" style={{ padding: '2rem' }}>
                                    <div className="spinner" style={{ width: '30px', height: '30px', borderWidth: '3px' }}></div>
                                    <p>Loading database...</p>
                                </div>
                            ) : (
                                <div className="table-wrapper db-table-wrapper">
                                    <table className="preview-table">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Spec Code</th>
                                                <th>Thick</th>
                                                <th>Width</th>
                                                <th>Length1</th>
                                                <th>Product No</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center">No products found. Start by adding one or running the migration.</td>
                                                </tr>
                                            ) : (
                                                products.map(p => (
                                                    <tr key={p.id}>
                                                        <td className="text-muted">#{p.id}</td>
                                                        <td className="font-mono">{p.spec_code}</td>
                                                        <td>{p.thick}</td>
                                                        <td>{p.width}</td>
                                                        <td>{p.length1}</td>
                                                        <td className="font-mono highlight-tag">{p.product_no}</td>
                                                        <td>
                                                            <div className="action-buttons" style={{ gap: '0.5rem' }}>
                                                                <button className="btn-icon edit" onClick={() => handleOpenForm(p)} title="Edit">✏️</button>
                                                                <button className="btn-icon delete" onClick={() => handleDelete(p.id)} title="Delete">🗑️</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductDatabaseModal;
