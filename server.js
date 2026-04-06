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
const cafeteriaRoutes = require('./routes/cafeteriaRoutes');
const reportRoutes = require('./routes/reportRoutes');

app.use('/', cafeteriaRoutes);
app.use('/reports', reportRoutes);

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
