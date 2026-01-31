// Middleware для перевірки ролі користувача
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Немає токена, доступ заборонено' });
    }

    const userRole = req.user.role;

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        message: 'У вас немає прав для виконання цієї дії',
      });
    }

    next();
  };
};

// Middleware для перевірки прав майстра-механіка (єдиний привілейований тип користувача)
const checkAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'master') {
    return res.status(403).json({
      message: 'Ця дія доступна тільки для майстрів-механіків',
    });
  }
  next();
};

// Middleware для перевірки прав механіка (майстра)
const checkMechanic = (req, res, next) => {
  if (!req.user || req.user.role !== 'master') {
    return res.status(403).json({
      message: 'Ця дія доступна тільки для майстрів-механіків',
    });
  }
  next();
};

module.exports = {
  checkRole,
  checkAdmin,
  checkMechanic,
};
