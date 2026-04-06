const express = require('express');
const db = require('../config/database');
const ReceiptController = require('../controllers/receiptController');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const [stats] = await db.all(`
            SELECT
                (SELECT COUNT(*) FROM menu_items) AS total_menu_items,
                (SELECT COUNT(*) FROM menu_items WHERE is_available = 1) AS available_menu_items,
                (SELECT COUNT(*) FROM orders) AS total_orders,
                (SELECT COUNT(*) FROM staff) AS total_staff
        `);

        const recentOrders = await db.all(`
            SELECT
                o.*,
                s.name AS staff_name,
                GROUP_CONCAT(COALESCE(mi.name, 'Блюдо удалено') || ' x' || oi.quantity, ', ') AS items_summary
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            LEFT JOIN staff s ON o.staff_id = s.id
            GROUP BY o.id
            ORDER BY o.order_date DESC, o.id DESC
            LIMIT 5
        `);

        res.render('dashboard', {
            title: 'Университетская столовая',
            stats: stats || {
                total_menu_items: 0,
                available_menu_items: 0,
                total_orders: 0,
                total_staff: 0
            },
            recentOrders
        });
    } catch (error) {
        console.error('Ошибка загрузки дашборда:', error);
        res.render('dashboard', {
            title: 'Университетская столовая',
            stats: {
                total_menu_items: 0,
                available_menu_items: 0,
                total_orders: 0,
                total_staff: 0
            },
            recentOrders: []
        });
    }
});

router.get('/menu', async (req, res) => {
    try {
        const menuItems = await db.all(`
            SELECT mi.*, mc.name AS category_name
            FROM menu_items mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            ORDER BY mc.name, mi.name
        `);

        const categories = await db.all('SELECT * FROM menu_categories ORDER BY name');

        res.render('menu', {
            title: 'Меню столовой',
            menuItems,
            categories
        });
    } catch (error) {
        console.error('Ошибка загрузки меню:', error);
        res.render('menu', {
            title: 'Меню столовой',
            menuItems: [],
            categories: []
        });
    }
});

router.post('/menu', async (req, res) => {
    try {
        const { category_id, name, description, price, calories, is_available } = req.body;

        await db.run(
            `INSERT INTO menu_items (category_id, name, description, price, calories, is_available)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                category_id,
                name,
                description || null,
                parseFloat(price) || 0,
                calories ? parseInt(calories, 10) : null,
                is_available === '0' ? 0 : 1
            ]
        );

        res.redirect('/menu');
    } catch (error) {
        console.error('Ошибка добавления блюда:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось добавить блюдо: ' + error.message
        });
    }
});

router.get('/menu/edit/:id', async (req, res) => {
    try {
        const menuItem = await db.get(`
            SELECT mi.*, mc.name AS category_name
            FROM menu_items mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            WHERE mi.id = ?
        `, [req.params.id]);

        const categories = await db.all('SELECT * FROM menu_categories ORDER BY name');

        if (!menuItem) {
            return res.redirect('/menu');
        }

        res.render('menu-edit', {
            title: 'Редактирование блюда',
            menuItem,
            categories
        });
    } catch (error) {
        console.error('Ошибка загрузки блюда:', error);
        res.redirect('/menu');
    }
});

router.post('/menu/edit/:id', async (req, res) => {
    try {
        const { category_id, name, description, price, calories, is_available } = req.body;

        await db.run(
            `UPDATE menu_items
             SET category_id = ?, name = ?, description = ?, price = ?, calories = ?, is_available = ?
             WHERE id = ?`,
            [
                category_id,
                name,
                description || null,
                parseFloat(price) || 0,
                calories ? parseInt(calories, 10) : null,
                is_available === '0' ? 0 : 1,
                req.params.id
            ]
        );

        res.redirect('/menu');
    } catch (error) {
        console.error('Ошибка редактирования блюда:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось обновить блюдо: ' + error.message
        });
    }
});

router.post('/menu/delete/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
        res.redirect('/menu');
    } catch (error) {
        console.error('Ошибка удаления блюда:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось удалить блюдо: ' + error.message
        });
    }
});

router.get('/orders', async (req, res) => {
    try {
        const orders = await db.all(`
            SELECT
                o.*,
                s.name AS staff_name,
                COALESCE(SUM(oi.quantity), 0) AS total_quantity,
                GROUP_CONCAT(COALESCE(mi.name, 'Блюдо удалено') || ' x' || oi.quantity, ', ') AS items_summary
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            LEFT JOIN staff s ON o.staff_id = s.id
            GROUP BY o.id
            ORDER BY o.order_date DESC, o.id DESC
        `);

        const menuItems = await db.all('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY name');
        const staff = await db.all('SELECT * FROM staff ORDER BY name');

        res.render('orders', {
            title: 'Заказы',
            orders,
            menuItems,
            staff
        });
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        res.render('orders', {
            title: 'Заказы',
            orders: [],
            menuItems: [],
            staff: []
        });
    }
});

router.post('/orders', async (req, res) => {
    try {
        const { staff_id, order_date, customer_type, status, comment } = req.body;

        const normalizedItems = normalizeOrderItems(req.body.items);
        if (normalizedItems.length === 0) {
            return res.status(400).render('error', { title: 'Ошибка', error: 'Добавьте хотя бы одно блюдо в заказ' });
        }

        const itemIds = normalizedItems.map((i) => i.menu_item_id);
        const placeholders = itemIds.map(() => '?').join(', ');
        const menuRows = await db.all(
            `SELECT id, name, price FROM menu_items WHERE id IN (${placeholders})`,
            itemIds
        );
        const menuMap = new Map(menuRows.map((r) => [Number(r.id), r]));

        const orderLines = [];
        let totalPrice = 0;
        for (const it of normalizedItems) {
            const menu = menuMap.get(it.menu_item_id);
            if (!menu) {
                continue;
            }

            const unitPrice = parseFloat(menu.price) || 0;
            const lineTotal = unitPrice * it.quantity;
            totalPrice += lineTotal;
            orderLines.push({
                menu_item_id: it.menu_item_id,
                menu_item_name: menu.name,
                quantity: it.quantity,
                unit_price: unitPrice,
                line_total: lineTotal
            });
        }

        if (orderLines.length === 0) {
            return res.status(400).render('error', { title: 'Ошибка', error: 'Не удалось сформировать позиции заказа' });
        }

        await db.exec('BEGIN');
        let orderId = null;
        try {
            const result = await db.run(
                `INSERT INTO orders (staff_id, order_date, customer_type, total_price, status, comment)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    staff_id || null,
                    order_date,
                    customer_type,
                    totalPrice,
                    status || 'new',
                    comment || null
                ]
            );

            orderId = result.id;
            for (const line of orderLines) {
                await db.run(
                    `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, line_total)
                     VALUES (?, ?, ?, ?, ?)`,
                    [orderId, line.menu_item_id, line.quantity, line.unit_price, line.line_total]
                );
            }

            await db.exec('COMMIT');
        } catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }

        const order = await db.get(
            `
            SELECT o.*, s.name AS staff_name
            FROM orders o
            LEFT JOIN staff s ON o.staff_id = s.id
            WHERE o.id = ?
            `,
            [orderId]
        );
        const items = await db.all(
            `
            SELECT oi.*, mi.name AS menu_item_name
            FROM order_items oi
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE oi.order_id = ?
            ORDER BY oi.id ASC
            `,
            [orderId]
        );

        return ReceiptController.streamReceiptPdf(res, { order, items });
    } catch (error) {
        console.error('Ошибка добавления заказа:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось добавить заказ: ' + error.message
        });
    }
});

router.get('/orders/:id/receipt', ReceiptController.downloadReceipt);

router.get('/orders/edit/:id', async (req, res) => {
    try {
        const order = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        const menuItems = await db.all('SELECT * FROM menu_items ORDER BY name');
        const staff = await db.all('SELECT * FROM staff ORDER BY name');
        const orderItems = await db.all(
            `
            SELECT oi.*, mi.name AS menu_item_name
            FROM order_items oi
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE oi.order_id = ?
            ORDER BY oi.id ASC
            `,
            [req.params.id]
        );

        if (!order) {
            return res.redirect('/orders');
        }

        res.render('orders-edit', {
            title: 'Редактирование заказа',
            order,
            orderItems,
            menuItems,
            staff
        });
    } catch (error) {
        console.error('Ошибка загрузки заказа:', error);
        res.redirect('/orders');
    }
});

router.post('/orders/edit/:id', async (req, res) => {
    try {
        const { staff_id, order_date, customer_type, status, comment } = req.body;

        const normalizedItems = normalizeOrderItems(req.body.items);
        if (normalizedItems.length === 0) {
            return res.status(400).render('error', { title: 'Ошибка', error: 'Добавьте хотя бы одно блюдо в заказ' });
        }

        const itemIds = normalizedItems.map((i) => i.menu_item_id);
        const placeholders = itemIds.map(() => '?').join(', ');
        const menuRows = await db.all(
            `SELECT id, price FROM menu_items WHERE id IN (${placeholders})`,
            itemIds
        );
        const menuMap = new Map(menuRows.map((r) => [Number(r.id), r]));

        let totalPrice = 0;
        const orderLines = [];
        for (const it of normalizedItems) {
            const menu = menuMap.get(it.menu_item_id);
            if (!menu) {
                continue;
            }
            const unitPrice = parseFloat(menu.price) || 0;
            const lineTotal = unitPrice * it.quantity;
            totalPrice += lineTotal;
            orderLines.push({ ...it, unitPrice, lineTotal });
        }

        await db.exec('BEGIN');
        try {
            await db.run(
                `UPDATE orders
                 SET staff_id = ?, order_date = ?, customer_type = ?, total_price = ?, status = ?, comment = ?
                 WHERE id = ?`,
                [
                    staff_id || null,
                    order_date,
                    customer_type,
                    totalPrice,
                    status,
                    comment || null,
                    req.params.id
                ]
            );

            await db.run('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
            for (const line of orderLines) {
                await db.run(
                    `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, line_total)
                     VALUES (?, ?, ?, ?, ?)`,
                    [req.params.id, line.menu_item_id, line.quantity, line.unitPrice, line.lineTotal]
                );
            }

            await db.exec('COMMIT');
        } catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }

        res.redirect('/orders');
    } catch (error) {
        console.error('Ошибка редактирования заказа:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось обновить заказ: ' + error.message
        });
    }
});

router.post('/orders/delete/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.redirect('/orders');
    } catch (error) {
        console.error('Ошибка удаления заказа:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось удалить заказ: ' + error.message
        });
    }
});

router.post('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = new Set(['new', 'preparing', 'completed', 'cancelled']);
        if (!allowed.has(status)) {
            return res.status(400).render('error', { title: 'Ошибка', error: 'Некорректный статус' });
        }

        await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
        res.redirect('/orders');
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось обновить статус: ' + error.message
        });
    }
});

function normalizeOrderItems(rawItems) {
    if (!rawItems) {
        return [];
    }

    const itemsArray = Array.isArray(rawItems) ? rawItems : Object.values(rawItems);

    const normalized = [];
    for (const item of itemsArray) {
        if (!item) {
            continue;
        }

        const menuItemId = Number(item.menu_item_id);
        const quantity = Math.max(Number.parseInt(item.quantity, 10) || 1, 1);
        if (!Number.isFinite(menuItemId) || menuItemId <= 0) {
            continue;
        }

        normalized.push({ menu_item_id: menuItemId, quantity });
    }

    // merge duplicates
    const merged = new Map();
    for (const item of normalized) {
        const current = merged.get(item.menu_item_id);
        if (current) {
            current.quantity += item.quantity;
        } else {
            merged.set(item.menu_item_id, { ...item });
        }
    }

    return Array.from(merged.values());
}

router.get('/staff', async (req, res) => {
    try {
        const staff = await db.all('SELECT * FROM staff ORDER BY name');
        res.render('staff', {
            title: 'Персонал столовой',
            staff
        });
    } catch (error) {
        console.error('Ошибка загрузки персонала:', error);
        res.render('staff', {
            title: 'Персонал столовой',
            staff: []
        });
    }
});

router.post('/staff', async (req, res) => {
    try {
        const { name, position, shift, phone, email } = req.body;

        await db.run(
            `INSERT INTO staff (name, position, shift, phone, email)
             VALUES (?, ?, ?, ?, ?)`,
            [name, position, shift, phone || null, email || null]
        );

        res.redirect('/staff');
    } catch (error) {
        console.error('Ошибка добавления сотрудника:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось добавить сотрудника: ' + error.message
        });
    }
});

router.get('/staff/edit/:id', async (req, res) => {
    try {
        const staffMember = await db.get('SELECT * FROM staff WHERE id = ?', [req.params.id]);

        if (!staffMember) {
            return res.redirect('/staff');
        }

        res.render('staff-edit', {
            title: 'Редактирование сотрудника',
            staffMember
        });
    } catch (error) {
        console.error('Ошибка загрузки сотрудника:', error);
        res.redirect('/staff');
    }
});

router.post('/staff/edit/:id', async (req, res) => {
    try {
        const { name, position, shift, phone, email } = req.body;

        await db.run(
            `UPDATE staff
             SET name = ?, position = ?, shift = ?, phone = ?, email = ?
             WHERE id = ?`,
            [name, position, shift, phone || null, email || null, req.params.id]
        );

        res.redirect('/staff');
    } catch (error) {
        console.error('Ошибка редактирования сотрудника:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось обновить сотрудника: ' + error.message
        });
    }
});

router.post('/staff/delete/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM staff WHERE id = ?', [req.params.id]);
        res.redirect('/staff');
    } catch (error) {
        console.error('Ошибка удаления сотрудника:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось удалить сотрудника: ' + error.message
        });
    }
});

module.exports = router;
