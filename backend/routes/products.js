const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all products
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// POST new product
router.post('/', async (req, res) => {
    const { specCode, thick, width, length1, productNo } = req.body;

    if (!specCode || !productNo) {
        return res.status(400).json({ error: 'specCode and productNo are required' });
    }

    try {
        const result = await db.query(
            'INSERT INTO products (spec_code, thick, width, length1, product_no) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [specCode, thick || 0, width || 0, length1 || 0, productNo]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding product:', err);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// PUT update product
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { specCode, thick, width, length1, productNo } = req.body;

    if (!specCode || !productNo) {
        return res.status(400).json({ error: 'specCode and productNo are required' });
    }

    try {
        const result = await db.query(
            'UPDATE products SET spec_code = $1, thick = $2, width = $3, length1 = $4, product_no = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
            [specCode, thick || 0, width || 0, length1 || 0, productNo, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// DELETE product
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully', id: id });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

module.exports = router;
