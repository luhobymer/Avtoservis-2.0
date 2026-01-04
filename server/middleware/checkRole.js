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

// Middleware для перевірки прав адміністратора
const checkAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Ця дія доступна тільки для адміністраторів',
    });
  }
  next();
};

// Middleware для перевірки прав механіка
const checkMechanic = (req, res, next) => {
  if (!req.user || !['admin', 'mechanic'].includes(req.user.role)) {
    return res.status(403).json({
      message: 'Ця дія доступна тільки для механіків',
    });
  }
  next();
};

module.exports = {
  checkRole,
  checkAdmin,
  checkMechanic,
};
