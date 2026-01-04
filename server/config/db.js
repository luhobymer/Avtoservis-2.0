const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize({
  pool: {
    max: 10, // Максимальна кількість з'єднань у пулі
    min: 0, // Мінімальна кількість з'єднань у пулі
    acquire: 30000, // Максимальний час (в мс), протягом якого пул намагатиметься отримати з'єднання
    idle: 10000, // Максимальний час (в мс), протягом якого з'єднання може бути неактивним, перш ніж буде звільнено
  },
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'avtoservis',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

module.exports = sequelize;
