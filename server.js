require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const db = require('./config/database');
const ReportController = require('./controllers/reportController');

app.get('/', async (req, res) => {
    try {
        const [stats] = await db.all(`
            SELECT
                (SELECT COUNT(*) FROM menu_items) AS total_menu_items,
                (SELECT COUNT(*) FROM menu_items WHERE is_available = 1) AS available_menu_items,
                (SELECT COUNT(*) FROM orders) AS total_orders,
                (SELECT COUNT(*) FROM staff) AS total_staff
        `);

        const recentOrders = await db.all(`
            SELECT o.*, mi.name AS menu_item_name, s.name AS staff_name
            FROM orders o
            LEFT JOIN menu_items mi ON o.menu_item_id = mi.id
            LEFT JOIN staff s ON o.staff_id = s.id
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

app.get('/menu', async (req, res) => {
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
        res.render('equipment', {
            title: 'Меню столовой',
            menuItems: [],
            categories: []
        });
    }
});

app.post('/menu', async (req, res) => {
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

app.get('/menu/edit/:id', async (req, res) => {
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

        res.render('equipment-edit', {
            title: 'Редактирование блюда',
            menuItem,
            categories
        });
    } catch (error) {
        console.error('Ошибка загрузки блюда:', error);
        res.redirect('/menu');
    }
});

app.post('/menu/edit/:id', async (req, res) => {
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

app.post('/menu/delete/:id', async (req, res) => {
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

app.get('/orders', async (req, res) => {
    try {
        const orders = await db.all(`
            SELECT o.*, mi.name AS menu_item_name, mi.price AS menu_price, s.name AS staff_name
            FROM orders o
            LEFT JOIN menu_items mi ON o.menu_item_id = mi.id
            LEFT JOIN staff s ON o.staff_id = s.id
            ORDER BY o.order_date DESC, o.id DESC
        `);

        const menuItems = await db.all('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY name');
        const staff = await db.all('SELECT * FROM staff ORDER BY name');

        res.render('repairs', {
            title: 'Заказы',
            orders,
            menuItems,
            staff
        });
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        res.render('repairs', {
            title: 'Заказы',
            orders: [],
            menuItems: [],
            staff: []
        });
    }
});

app.post('/orders', async (req, res) => {
    try {
        const { menu_item_id, staff_id, order_date, customer_type, quantity, status, comment } = req.body;
        const selectedItem = await db.get('SELECT price FROM menu_items WHERE id = ?', [menu_item_id]);
        const qty = Math.max(parseInt(quantity, 10) || 1, 1);
        const totalPrice = selectedItem ? (parseFloat(selectedItem.price) || 0) * qty : 0;

        await db.run(
            `INSERT INTO orders (menu_item_id, staff_id, order_date, customer_type, quantity, total_price, status, comment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                menu_item_id,
                staff_id || null,
                order_date,
                customer_type,
                qty,
                totalPrice,
                status || 'new',
                comment || null
            ]
        );

        res.redirect('/orders');
    } catch (error) {
        console.error('Ошибка добавления заказа:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось добавить заказ: ' + error.message
        });
    }
});

app.get('/orders/edit/:id', async (req, res) => {
    try {
        const order = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        const menuItems = await db.all('SELECT * FROM menu_items ORDER BY name');
        const staff = await db.all('SELECT * FROM staff ORDER BY name');

        if (!order) {
            return res.redirect('/orders');
        }

        res.render('repairs-edit', {
            title: 'Редактирование заказа',
            order,
            menuItems,
            staff
        });
    } catch (error) {
        console.error('Ошибка загрузки заказа:', error);
        res.redirect('/orders');
    }
});

app.post('/orders/edit/:id', async (req, res) => {
    try {
        const { menu_item_id, staff_id, order_date, customer_type, quantity, status, comment } = req.body;
        const selectedItem = await db.get('SELECT price FROM menu_items WHERE id = ?', [menu_item_id]);
        const qty = Math.max(parseInt(quantity, 10) || 1, 1);
        const totalPrice = selectedItem ? (parseFloat(selectedItem.price) || 0) * qty : 0;

        await db.run(
            `UPDATE orders
             SET menu_item_id = ?, staff_id = ?, order_date = ?, customer_type = ?,
                 quantity = ?, total_price = ?, status = ?, comment = ?
             WHERE id = ?`,
            [
                menu_item_id,
                staff_id || null,
                order_date,
                customer_type,
                qty,
                totalPrice,
                status,
                comment || null,
                req.params.id
            ]
        );

        res.redirect('/orders');
    } catch (error) {
        console.error('Ошибка редактирования заказа:', error);
        res.render('error', {
            title: 'Ошибка',
            error: 'Не удалось обновить заказ: ' + error.message
        });
    }
});

app.post('/orders/delete/:id', async (req, res) => {
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

app.get('/staff', async (req, res) => {
    try {
        const staff = await db.all('SELECT * FROM staff ORDER BY name');
        res.render('employees', {
            title: 'Персонал столовой',
            staff
        });
    } catch (error) {
        console.error('Ошибка загрузки персонала:', error);
        res.render('employees', {
            title: 'Персонал столовой',
            staff: []
        });
    }
});

app.post('/staff', async (req, res) => {
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

app.get('/staff/edit/:id', async (req, res) => {
    try {
        const staffMember = await db.get('SELECT * FROM staff WHERE id = ?', [req.params.id]);

        if (!staffMember) {
            return res.redirect('/staff');
        }

        res.render('employees-edit', {
            title: 'Редактирование сотрудника',
            staffMember
        });
    } catch (error) {
        console.error('Ошибка загрузки сотрудника:', error);
        res.redirect('/staff');
    }
});

app.post('/staff/edit/:id', async (req, res) => {
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

app.post('/staff/delete/:id', async (req, res) => {
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

app.get('/reports/orders', ReportController.generateOrdersReport);

app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Страница не найдена',
        error: 'Запрашиваемая страница не существует'
    });
});

app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).render('error', {
        title: 'Ошибка сервера',
        error: 'Внутренняя ошибка сервера'
    });
});

const startServer = async () => {
    try {
        await db.connect();
        console.log('✅ База данных подключена');

        app.listen(PORT, () => {
            console.log(`🚀 Университетская столовая запущена на http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Ошибка запуска:', error);
    }
};

startServer();
