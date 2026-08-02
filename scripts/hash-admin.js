const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('123', 10));
