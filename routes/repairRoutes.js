const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/menu', async (req, res) => {
    try {
        const menuItems = await db.all(`
            SELECT mi.*, mc.name AS category_name
            FROM menu_items mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            ORDER BY mc.name, mi.name
        `);

        const categories = await db.all('SELECT * FROM menu_categories ORDER BY name');

        res.render('equipment', {
            title: 'Меню столовой',
            menuItems,
            categories
        });
    } catch (error) {
        console.error('Ошибка загрузки меню:', error);
        res.render('error', { title: 'Ошибка', error: 'Не удалось загрузить меню' });
    }
});

router.get('/orders', async (req, res) => {
    try {
        const orders = await db.all(`
            SELECT o.*, mi.name AS menu_item_name, s.name AS staff_name
            FROM orders o
            LEFT JOIN menu_items mi ON o.menu_item_id = mi.id
            LEFT JOIN staff s ON o.staff_id = s.id
            ORDER BY o.order_date DESC, o.id DESC
        `);

        const menuItems = await db.all('SELECT * FROM menu_items ORDER BY name');
        const staff = await db.all('SELECT * FROM staff ORDER BY name');

        res.render('repairs', {
            title: 'Заказы столовой',
            orders,
            menuItems,
            staff
        });
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        res.render('error', { title: 'Ошибка', error: 'Не удалось загрузить заказы' });
    }
});

router.get('/staff', async (req, res) => {
    try {
        const staff = await db.all('SELECT * FROM staff ORDER BY name');
        res.render('employees', {
            title: 'Персонал столовой',
            staff
        });
    } catch (error) {
        console.error('Ошибка загрузки персонала:', error);
        res.render('error', { title: 'Ошибка', error: 'Не удалось загрузить персонал' });
    }
});

module.exports = router;
